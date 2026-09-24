import { NAV_ITEMS } from "../config/navigation";
import { withBase } from "../utils/basePath";
import { UserRound } from "lucide";
import { useEffect, useState } from "preact/hooks";

/** @param {{ persistent?: boolean, userEmail?: string | null }} props */
export default function Navigation({ persistent = false, userEmail = null }) {
  const [sessionEmail, setSessionEmail] = useState(userEmail);
  useEffect(() => {
    let active = true;
    let unsubscribe;
    void import("../lib/supabase/client").then(async ({ supabase }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (active) setSessionEmail(user?.email ?? null);
      const listener = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setSessionEmail(session?.user.email ?? null);
      });
      unsubscribe = () => listener.data.subscription.unsubscribe();
    }).catch(() => { if (active) setSessionEmail(null); });
    return () => { active = false; unsubscribe?.(); };
  }, []);
  return (
    <>
      <nav
        id="main-nav"
        data-persistent={persistent ? "true" : undefined}
        aria-label="Navegacion principal"
        class="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      >
        <div class="main-nav__fx" aria-hidden="true">
        </div>
        <div class="main-nav__floating-links-layer hidden md:block" aria-hidden="true">
          <div class="main-nav__floating-links-wrap">
            <ul class="main-nav__floating-links nav-links-cluster text-sm font-medium tracking-wide uppercase">
              {NAV_ITEMS.map((item) => (
                <li key={`floating-${item.href}`}>
                  <span class="nav-link main-nav__link main-nav__link--ghost text-sm md:text-base font-medium uppercase tracking-wider">
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div class="main-nav__inner">
          <a
            href={withBase("/")}
            aria-label="Ir al inicio"
            class="main-nav__brand text-2xl font-bold tracking-tight hover:text-[var(--color-red-accent)] transition-colors"
            data-return-to-hero
          >
            <img
              src={withBase("/images/logo-redv2-96.webp")}
              alt="Imperio Español"
              width="96"
              height="74"
              loading="eager"
              decoding="async"
              class="main-nav__logo"
            />
          </a>

          <div class="main-nav__links-wrap hidden md:block">
            <ul class="main-nav__links nav-links-cluster text-sm font-medium tracking-wide uppercase">
              {NAV_ITEMS.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target={item.target}
                    rel={item.rel}
                    class="nav-link main-nav__link text-sm md:text-base font-medium uppercase tracking-wider transition-colors duration-300"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div class="main-nav__actions">
          <a href={withBase("/cuenta")} class={`menu-button account-button${sessionEmail ? " account-button--email" : ""}`} aria-label={sessionEmail ? `Mi cuenta: ${sessionEmail}` : "Mi cuenta / Iniciar sesion"} title={sessionEmail ?? "Mi cuenta / Iniciar sesion"}>
            {sessionEmail ? <span class="account-button__email">{sessionEmail}</span> : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              {UserRound.map(([Tag, attrs], index) => <Tag key={index} {...attrs} />)}
            </svg>}
          </a>
          <button
            id="mobile-menu-btn"
            type="button"
            class="menu-button"
            aria-label="Abrir menu"
            aria-controls="mobile-menu"
            aria-expanded="false"
          >
            <span class="menu-icon" aria-hidden="true">
              <span class="menu-icon__line menu-icon__line--top"></span>
              <span class="menu-icon__line menu-icon__line--middle"></span>
              <span class="menu-icon__line menu-icon__line--bottom"></span>
            </span>
          </button>
          </div>
        </div>

      </nav>

      <div
        id="mobile-menu"
        role="dialog"
        aria-label="Menu de navegacion"
        aria-modal="true"
        aria-hidden="true"
        class="side-bar"
      >
        <div class="side-bar__media" aria-hidden="true">
          <picture data-menu-media>
            <source
              type="image/avif"
              media="(max-width: 767px)"
              data-srcset={withBase("/images/red_hamburguer_phone-768.avif")}
            />
            <source
              media="(max-width: 767px)"
              data-srcset={withBase("/images/red_hamburguer_phone-768.webp")}
            />
            <source
              type="image/avif"
              data-srcset={withBase("/images/red_hamburguer_final-1600.avif")}
            />
            <img
              data-src={withBase("/images/red_hamburguer_final-1600.webp")}
              alt=""
              width="1600"
              height="890"
              class="side-bar__media-image"
              decoding="async"
              loading="lazy"
              fetchpriority="low"
            />
          </picture>
        </div>
        <div class="side-bar__veil" aria-hidden="true"></div>

        <div class="side-bar__panel container mx-auto px-6 py-6">
          <ul class="side-bar__nav">
            {NAV_ITEMS.map((item, index) => (
              <li
                key={item.href}
                class="side-bar__nav-item"
                style={{ "--side-link-index": index }}
              >
                <a href={item.href} target={item.target} rel={item.rel} class="side-bar__link">
                  <span class="side-bar__marker" aria-hidden="true">×</span>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <style>{`
        .main-nav__inner {
          position: relative;
          z-index: 4;
          width: 100%;
          min-height: calc(var(--space-unit) * 8);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-inline: var(--home-nav-logo-x, 4px);
          padding-block: var(--space-1);
        }

        .main-nav__fx {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          pointer-events: none;
          transition: opacity 0.72s cubic-bezier(0.22, 1, 0.36, 1);
          /* Para los alumnos:
             Este fondo siempre es un linear-gradient vertical.
             Solo cambiamos tres variables desde JS:
             1. la opacidad del blanco arriba,
             2. la opacidad del blanco abajo,
             3. y hasta donde "baja" el gradiente. */
          background:
            linear-gradient(
              135deg,
              rgba(255, 255, 255, calc(var(--nav-glass-alpha, 0.12) * 0.95)) 0%,
              rgba(255, 255, 255, 0) 42%
            ),
            radial-gradient(
              circle at 18% 0%,
              rgba(255, 255, 255, var(--nav-glass-line-alpha, 0.22)) 0%,
              rgba(255, 255, 255, 0) 58%
            ),
            rgba(255, 255, 255, var(--nav-gradient-top-alpha, 0.15));
          background: -webkit-linear-gradient(
            180deg,
            rgba(255, 255, 255, var(--nav-gradient-top-alpha, 0.15)) 0%,
            rgba(255, 255, 255, var(--nav-gradient-bottom-alpha, 0))
              var(--nav-gradient-stop, 5%),
            rgba(255, 255, 255, var(--nav-gradient-bottom-alpha, 0)) 100%
          );
          background: -moz-linear-gradient(
            180deg,
            rgba(255, 255, 255, var(--nav-gradient-top-alpha, 0.15)) 0%,
            rgba(255, 255, 255, var(--nav-gradient-bottom-alpha, 0))
              var(--nav-gradient-stop, 5%),
            rgba(255, 255, 255, var(--nav-gradient-bottom-alpha, 0)) 100%
          );
          background: linear-gradient(
            180deg,
            rgba(255, 255, 255, var(--nav-gradient-top-alpha, 0.15)) 0%,
            rgba(255, 255, 255, var(--nav-gradient-bottom-alpha, 0))
              var(--nav-gradient-stop, 5%),
            rgba(255, 255, 255, var(--nav-gradient-bottom-alpha, 0)) 100%
          );
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, var(--nav-glass-line-alpha, 0.22)),
            inset 0 -1px 0 rgba(255, 255, 255, calc(var(--nav-glass-line-alpha, 0.22) * 0.35));
        }

        .main-nav__brand {
          display: inline-flex;
          align-items: center;
          margin: 0;
          transition: opacity 0.72s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .main-nav__logo {
          width: auto;
          height: 2.7rem;
          opacity: var(--home-nav-logo-opacity, 1);
          transition: opacity 0.3s ease, transform 0.3s ease, filter 0.3s ease;
        }

        .main-nav__floating-links-layer {
          position: fixed;
          inset: 0;
          z-index: 3;
          opacity: 0;
          pointer-events: none;
          will-change: opacity;
          transition: opacity 0.72s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .main-nav__floating-links-wrap {
          position: absolute;
          left: var(--nav-floating-x, 50vw);
          top: var(--nav-floating-y, -200px);
          width: max-content;
          transform: translate(-50%, -50%);
          will-change: left, top;
        }

        .main-nav__floating-links {
          color: #111;
          opacity: 1;
        }

        .main-nav__links-wrap {
          position: absolute;
          left: 50%;
          top: calc(50% + var(--nav-letters-offset-y, 0px));
          z-index: 2;
          transform: translate(-50%, -50%);
          transition: opacity 0.72s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .main-nav__links {
          color: #111;
          opacity: var(--nav-links-progress, 1);
          will-change: opacity;
          pointer-events: none;
        }

        #main-nav.main-nav--merged .main-nav__links {
          pointer-events: auto;
        }

        .main-nav__link {
          color: rgba(17, 17, 17, calc(0.58 + var(--nav-links-progress, 0) * 0.42));
          white-space: nowrap;
        }

        .main-nav__link:hover,
        .main-nav__link:focus-visible {
          color: var(--color-red-accent);
        }

        .main-nav__brand:hover .main-nav__logo,
        .main-nav__brand:focus-visible .main-nav__logo {
          filter: brightness(0);
          opacity: 1;
          transform: translateY(-1px);
        }

        .main-nav__actions {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
          position: relative;
          z-index: 8;
        }

        .menu-button {
          position: relative;
          z-index: 8;
          border: 1px solid transparent;
          background: transparent;
          padding: 0;
          width: 48px;
          height: 44px;
          color: #fff;
          -webkit-tap-highlight-color: transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          mix-blend-mode: difference;
          transition: color 0.18s linear, mix-blend-mode 0s linear 0.18s;
        }

        #main-nav.main-nav--hamburger-dark .menu-button {
          color: #111;
          mix-blend-mode: normal;
          transition-delay: 0s;
        }

        .menu-icon {
          position: relative;
          width: 34px;
          height: 34px;
          display: block;
        }

        .menu-icon__line {
          position: absolute;
          left: 3px;
          width: 28px;
          height: 2px;
          background: currentColor;
          border-radius: 999px;
          display: block;
          transform-origin: 50% 50%;
          will-change: transform, opacity;
        }

        .menu-icon__line--top {
          left: 3px;
          width: 14px;
          transform-origin: 0% 50%;
          transform: translateY(9px) rotate(0deg);
        }

        .menu-icon__line--middle {
          left: 3px;
          width: 28px;
          transform-origin: 50% 50%;
          transform: translateY(16px) rotate(0deg);
          opacity: 1;
        }

        .menu-icon__line--bottom {
          left: 17px;
          width: 14px;
          transform-origin: 100% 50%;
          transform: translateY(23px) rotate(0deg);
        }

        .menu-button:hover {
          opacity: 1;
        }

        .menu-button:focus-visible {
          outline: 2px solid rgba(0, 0, 0, 0.35);
          outline-offset: 4px;
          border-radius: 8px;
        }

        .side-bar {
          position: fixed;
          inset: 0;
          z-index: 160;
          width: 100vw;
          height: 100dvh;
          overflow: hidden;
          color: #fff;
          opacity: 1;
          visibility: hidden;
          pointer-events: none;
          background: transparent;
        }

        .side-bar--open {
          visibility: visible;
          pointer-events: auto;
        }

        .side-bar__media,
        .side-bar__veil,
        .side-bar__panel {
          position: absolute;
          inset: 0;
        }

        .side-bar__media {
          top: 0;
          bottom: 0;
          right: 0;
          left: auto;
          width: 0;
          z-index: 0;
          overflow: hidden;
          background-color: #8e120d;
          transition: width 1.55s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: width;
        }

        .side-bar--revealed .side-bar__media {
          width: 100%;
        }

        .side-bar__media-image {
          position: absolute;
          top: 0;
          right: 0;
          display: block;
          width: 100vw;
          height: 100dvh;
          max-width: none;
          max-height: none;
          object-fit: fill;
          opacity: 1;
          transform: none;
        }

        .side-bar__veil {
          z-index: 1;
          background: none;
        }

        .side-bar__panel {
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: flex-end;
        }

        .side-bar__nav {
          display: grid;
          gap: clamp(0.8rem, 1.8vw, 1.4rem);
          list-style: none;
          width: min(76vw, 1100px);
          margin: 0;
          padding: 0;
          justify-items: end;
          text-align: right;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .side-bar--revealed .side-bar__nav {
          opacity: 1;
          transition-delay: 0.72s;
        }

        .side-bar__nav-item {
          opacity: 0;
          transform: translate3d(-44px, 0, 0);
          transition:
            opacity 0.44s ease,
            transform 0.72s cubic-bezier(0.22, 1, 0.36, 1);
        }

        .side-bar--revealed .side-bar__nav-item {
          opacity: 1;
          transform: translate3d(0, 0, 0);
          transition-delay: calc(0.78s + (var(--side-link-index, 0) * 120ms));
        }

        .side-bar__link {
          position: relative;
          display: inline-block;
          color: #fff;
          font-family: var(--font-rosa-black);
          font-size: clamp(2rem, 4.167vw, 3.833rem);
          font-weight: 900;
          line-height: 0.88;
          letter-spacing: 0;
          white-space: nowrap;
          text-transform: uppercase;
          text-decoration: none;
          text-shadow: 0 12px 32px rgba(0, 0, 0, 0.3);
          max-width: 100%;
          transition: color 180ms ease;
        }

        .side-bar__marker {
          position: absolute;
          top: 50%;
          right: calc(100% + 0.22em);
          color: #000;
          font: inherit;
          font-size: 0.72em;
          line-height: 1;
          opacity: 0;
          transform: translate(0.3em, -50%) scale(0.82);
          transform-origin: center;
          pointer-events: auto;
          transition:
            opacity 180ms ease,
            transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .side-bar__link:hover,
        .side-bar__link:focus-visible {
          color: #000;
        }

        .side-bar__link:hover .side-bar__marker,
        .side-bar__link:focus-visible .side-bar__marker {
          opacity: 1;
          transform: translate(0, -50%) scale(1);
        }

        #main-nav {
          z-index: 170;
          --nav-progress: 0;
          --nav-links-progress: 0;
          --nav-gradient-top-alpha: 0.15;
          --nav-gradient-bottom-alpha: 0;
          --nav-gradient-stop: 5%;
          --nav-glass-alpha: 0.12;
          --nav-glass-line-alpha: 0.22;
          --nav-glass-shadow-alpha: 0.08;
          --nav-docked-opacity: 0;
          --nav-floating-opacity: 0;
          --nav-floating-x: 50vw;
          --nav-floating-y: -200px;
          background: transparent;
          box-shadow:
            0 12px 36px rgba(15, 23, 42, var(--nav-glass-shadow-alpha, 0.08)),
            0 2px 16px rgba(255, 255, 255, calc(var(--nav-glass-line-alpha, 0.22) * 0.2));
          backdrop-filter: blur(calc(14px + var(--nav-progress) * 10px)) saturate(calc(1.05 + var(--nav-progress) * 0.45));
          -webkit-backdrop-filter: blur(calc(14px + var(--nav-progress) * 10px)) saturate(calc(1.05 + var(--nav-progress) * 0.45));
          border-bottom: 1px solid rgba(255, 255, 255, calc(var(--nav-glass-line-alpha, 0.22) * 0.7));
          opacity: 0;
          transform: translateY(-12px);
          pointer-events: none;
          transition:
            opacity 0.4s ease,
            transform 0.4s ease,
            box-shadow 0.72s cubic-bezier(0.22, 1, 0.36, 1),
            border-bottom-color 0.72s cubic-bezier(0.22, 1, 0.36, 1),
            backdrop-filter 0.72s cubic-bezier(0.22, 1, 0.36, 1),
            -webkit-backdrop-filter 0.72s cubic-bezier(0.22, 1, 0.36, 1);
        }

        #main-nav.main-nav--menu-fading {
          box-shadow: none;
          border-bottom-color: transparent;
          backdrop-filter: blur(0px) saturate(1);
          -webkit-backdrop-filter: blur(0px) saturate(1);
        }

        #main-nav.main-nav--menu-open .main-nav__floating-links-layer,
        #main-nav.main-nav--menu-open .main-nav__links-wrap {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        #main-nav.main-nav--menu-fading .main-nav__fx,
        #main-nav.main-nav--menu-fading .main-nav__brand,
        #main-nav.main-nav--menu-fading .main-nav__floating-links-layer,
        #main-nav.main-nav--menu-fading .main-nav__links-wrap {
          opacity: 0;
          pointer-events: none;
        }

        #main-nav.main-nav--menu-revealed .menu-button {
          color: #000;
          mix-blend-mode: normal;
          transition-delay: 0s;
        }

        body.preloader-done #main-nav {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }


        @media (min-width: 768px) {
          .main-nav__logo {
            height: 2.95rem;
          }
        }

        @media (max-width: 767px) {
          .main-nav__floating-links-layer,
          .main-nav__links-wrap {
            display: none;
          }

          .main-nav__inner {
            min-height: calc(var(--space-unit) * 7);
          }

          .main-nav__logo {
            height: clamp(2.1rem, 10vw, 2.55rem);
          }

          .side-bar__panel {
            align-items: stretch;
            justify-content: center;
            overflow-y: auto;
            padding: clamp(5.5rem, 13svh, 7.25rem) clamp(1rem, 5vw, 1.5rem) clamp(1.5rem, 6svh, 2.5rem);
          }

          .side-bar__nav {
            width: min(100%, 540px);
            margin-inline: auto;
            grid-template-columns: minmax(0, 1fr);
            grid-auto-rows: auto;
            gap: clamp(0.7rem, 2svh, 1.05rem);
            justify-items: start;
            text-align: left;
          }

          .side-bar__link {
            display: block;
            width: 100%;
            padding-left: 0.82em;
            font-size: clamp(1.7rem, 7.2vw, 3rem);
            line-height: 0.9;
            white-space: normal;
            overflow-wrap: anywhere;
          }

          .side-bar__marker {
            right: auto;
            left: 0;
            font-size: 0.7em;
          }
        }

        @media (max-width: 380px), (max-width: 767px) and (max-height: 700px) {
          .side-bar__panel {
            justify-content: flex-start;
            padding-top: clamp(4.5rem, 11svh, 5.5rem);
          }

          .side-bar__nav {
            grid-auto-rows: minmax(44px, auto);
            gap: clamp(0.35rem, 1.15svh, 0.65rem);
          }

          .side-bar__link {
            font-size: clamp(1.33rem, 6.33vw, 2.33rem);
            line-height: 0.9;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .side-bar,
          .side-bar__media,
          .side-bar__media-image,
          .side-bar__veil,
          .side-bar__nav,
          .side-bar__nav-item {
            transition-duration: 0.01ms;
            transition-delay: 0s;
          }
        }
      `}</style>
    </>
  );
}
