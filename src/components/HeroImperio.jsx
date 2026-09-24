import { useEffect } from "preact/hooks";
import LogoImperio from "./LogoImperio";
import LatinLayers from "./LatinLayers";
import NavLinksList from "./NavLinksList";
import { withBase } from "../utils/basePath";
import {
  HERO_ENTRANCE_SEQUENCE,
  HERO_IMAGE_AVIF_SRC_SET,
  HERO_IMAGE_DEFAULT_SRC,
  HERO_IMAGE_MOBILE_AVIF_SRC,
  HERO_IMAGE_MOBILE_SRC,
  HERO_IMAGE_WEBP_SRC_SET,
  HERO_LAYER_VARS,
  HERO_VIEW_TRANSITION_NAME,
  LATIN_LAYER_ANIMATION,
  LATIN_LAYER_SEQUENCE,
} from "../config/hero";

export default function HeroImperio() {
  useEffect(() => {
    const heroSection = document.querySelector(".hero-imperio");
    const heroBackground = document.querySelector(".hero-background");
    const heroImage = heroBackground?.querySelector("img");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timers = [];

    const queueStage = (callback, delay) => {
      if (reducedMotion || delay <= 0) {
        callback();
        return;
      }
      timers.push(window.setTimeout(callback, delay));
    };

    const resetEntranceSequence = () => {
      heroSection?.classList.remove(
        "hero-imperio--wordmark-ready",
        "hero-imperio--nav-ready",
        "hero-imperio--latin-ready"
      );
    };

    const startEntranceSequence = () => {
      if (!heroSection) return;

      resetEntranceSequence();
      queueStage(
        () => heroSection.classList.add("hero-imperio--wordmark-ready"),
        HERO_ENTRANCE_SEQUENCE.wordmarkDelayMs
      );
      queueStage(
        () => heroSection.classList.add("hero-imperio--nav-ready"),
        HERO_ENTRANCE_SEQUENCE.navBandDelayMs
      );
      queueStage(
        () => heroSection.classList.add("hero-imperio--latin-ready"),
        HERO_ENTRANCE_SEQUENCE.latinDelayMs
      );
    };

    const onScroll = () => {
      if (!heroBackground) return;
      const target = heroImage || heroBackground;
      if (!document.body.classList.contains("preloader-done")) {
        target.style.transform = "translateY(0)";
        return;
      }
      const scrolled = window.pageYOffset;
      target.style.transform = `translateY(${scrolled * 0.5}px)`;
    };

    const setHeroImage = (src) => {
      if (!heroImage || !src) return;
      if (heroImage.getAttribute("src") === src) return;
      const next = new window.Image();
      next.decoding = "async";
      next.src = src;
      next
        .decode()
        .catch(() => undefined)
        .finally(() => {
          heroImage.src = src;
        });
    };

    if (heroImage) {
      heroImage.src = HERO_IMAGE_DEFAULT_SRC;
      heroImage.decoding = "async";
      heroImage.fetchPriority = "high";
      heroImage.loading = "eager";
      heroImage.decode().catch(() => undefined);
    }

    const onLastImage = (event) => {
      const src = event?.detail?.src;
      if (src) setHeroImage(src);
    };

    const onPreloaderDone = () => {
      onScroll();
      startEntranceSequence();
    };

    window.addEventListener("preloader:last-image", onLastImage, { once: true });
    window.addEventListener("preloader:done", onPreloaderDone, { once: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    if (document.body.classList.contains("preloader-done")) {
      startEntranceSequence();
    }
    onScroll();

    return () => {
      timers.forEach((timerId) => window.clearTimeout(timerId));
      resetEntranceSequence();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("preloader:last-image", onLastImage);
      window.removeEventListener("preloader:done", onPreloaderDone);
    };
  }, []);

  return (
    <>
      <section class="hero-imperio relative min-h-screen flex flex-col justify-between overflow-hidden bg-black">
        <div class="hero-background absolute inset-0" aria-hidden="true">
          <picture>
            <source
              type="image/avif"
              media="(max-width: 768px)"
              srcSet={HERO_IMAGE_MOBILE_AVIF_SRC}
            />
            <source media="(max-width: 768px)" srcSet={HERO_IMAGE_MOBILE_SRC} />
            <source type="image/avif" srcSet={HERO_IMAGE_AVIF_SRC_SET} sizes="100vw" />
            <img
              src={HERO_IMAGE_DEFAULT_SRC}
              srcSet={HERO_IMAGE_WEBP_SRC_SET}
              sizes="100vw"
              alt=""
              width="2496"
              height="1664"
              loading="eager"
              decoding="async"
              fetchpriority="high"
              class="hero-background__img"
            />
          </picture>
        </div>

        <div class="hero-content hero-imperio__content flex-1 flex flex-col items-center justify-center relative z-10 px-6">
          <div class="hero-imperio__lockup" style={HERO_LAYER_VARS}>
            <div class="hero-imperio__headline">
              <h1 class="hero-imperio__title">
                <LogoImperio
                  width={720}
                  className="hero-imperio__wordmark"
                  title="Imperio Español"
                  classes={{
                    corona: "hero-imperio__corona-part",
                    imperio: "hero-imperio__imperio-part",
                    espanol: "hero-imperio__espanol-part",
                  }}
                />
              </h1>
            </div>

            <div class="hero-imperio__latin-wrap">
              <div
                class="hero-imperio__latin-block"
                data-part="latin"
                aria-hidden="true"
              >
                <LatinLayers
                  src={withBase("/images/Letras_latin.svg")}
                  className="hero-imperio__latin-layers"
                  layers={LATIN_LAYER_SEQUENCE}
                  animation={LATIN_LAYER_ANIMATION}
                />
              </div>
            </div>
          </div>
        </div>

        <nav class="hero-nav hero-imperio__nav relative z-10 pb-0 opacity-0">
          <div class="hero-nav__surface">
            <div class="home-shell hero-nav__shell">
              <div class="hero-nav__links-wrap">
                <NavLinksList
                  className="hero-nav__links-list nav-links-cluster text-black text-sm md:text-base font-medium uppercase tracking-wider"
                  linkClassName="hover:text-[var(--color-red-accent)] transition-colors duration-300"
                />
              </div>
            </div>
          </div>
        </nav>
        <div class="hero-nav__overlay hidden md:block">
          <div class="hero-nav__overlay-wrap">
            <NavLinksList
              itemKeyPrefix="overlay-"
              className="hero-nav__overlay-list nav-links-cluster text-black text-sm md:text-base font-medium uppercase tracking-wider"
              linkClassName="hover:text-[var(--color-red-accent)] transition-colors duration-300"
            />
          </div>
        </div>
      </section>

      <style>{`
        .hero-imperio {
          min-height: 100vh;
          position: relative;
        }

        .hero-background {
          pointer-events: none;
          opacity: 0;
        }

        body.preloader-done .hero-background {
          opacity: 1;
        }

        .hero-background picture {
          display: block;
          width: 100%;
          height: 100%;
        }

        .hero-background__img {
          filter: brightness(0.75);
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          will-change: transform;
        }

        @supports (view-transition-name: ${HERO_VIEW_TRANSITION_NAME}) {
          body.preloader-done .hero-background__img {
            view-transition-name: ${HERO_VIEW_TRANSITION_NAME};
          }
        }

        .hero-imperio__lockup {
          --wordmark-w: min(70vw, 450px);
          --imperio-x: 0px;
          --imperio-y: 0px;
          --imperio-opacity: 0.5;
          --espanol-x: 0px;
          --espanol-y: 0px;
          --espanol-opacity: 1;
          --latin-x: 0px;
          --latin-y: 0px;
          --latin-opacity: 1;
          position: absolute;
          left: 50%;
          top: 58%;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: calc(var(--space-unit) * 1.4);
          z-index: 2;
        }

        .hero-imperio__headline {
          width: var(--wordmark-w);
          text-align: center;
        }

        .hero-imperio__title {
          margin: 0;
          line-height: 0;
          width: var(--wordmark-w);
          display: flex;
          justify-content: center;
        }

        .hero-imperio__wordmark {
          display: inline-block;
          width: 100%;
          height: auto;
          transform: translateY(40px);
          opacity: 0;
          transition: transform 1.2s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 1.2s ease;
        }

        .hero-imperio__corona-part {
          visibility: hidden;
          
        }

        .hero-imperio__imperio-part,
        .hero-imperio__espanol-part {
          transform-box: fill-box;
          transform-origin: center;
          will-change: transform, opacity, filter;
        }

        .hero-imperio__imperio-part {
          opacity: 0;
          transform: translate(var(--imperio-x), calc(var(--imperio-y) + 28px));
          transition: transform 1s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 1s ease;
          transition-delay: 220ms;
        }

        .hero-imperio__espanol-part {
          opacity: 0;
          transform: translate(var(--espanol-x), calc(var(--espanol-y) + 130px));
          filter: url(#logo-noise);
          transition: transform 1.6s cubic-bezier(0.22, 1, 0.36, 1),
            opacity 1.6s ease,
            filter 1.2s ease;
          transition-delay: 520ms;
        }

        .hero-imperio__latin-wrap {
          width: var(--wordmark-w);
          display: flex;
          justify-content: center;
          align-items: center;
        }

        .hero-imperio__latin-block {
          width: var(--wordmark-w);
          transform: translate(var(--latin-x), var(--latin-y));
          opacity: var(--latin-opacity);
          display: flex;
          justify-content: center;
          align-items: center;
          position: relative;
        }

        .hero-imperio__latin-block::before,
        .hero-imperio__latin-block::after {
          display:block;
          flex:0 0 auto;
          color:#111;
          font:700 2rem/1 Georgia, serif;
          opacity:0;
          transition:opacity 0.35s ease;
        }
        .hero-imperio__latin-block::before { content:'“'; }
        .hero-imperio__latin-block::after { content:'”'; }
        .hero-imperio--latin-ready .hero-imperio__latin-block::before,
        .hero-imperio--latin-ready .hero-imperio__latin-block::after { opacity:1; }

        .hero-imperio__latin-layers {
          display: block;
          width: calc(100% - 3rem);
          opacity: 0;
          transition: opacity 0.35s ease;
        }

        .hero-imperio__nav {
          opacity: 0;
          transform: translateY(var(--space-10));
          will-change: transform, opacity;
          transition: transform 1.15s cubic-bezier(0.2, 0.9, 0.22, 1),
            opacity 0.85s ease;
        }

        .hero-nav__surface {
          position: relative;
          background: var(--color-white-pure);
          padding: 0;
          z-index: 0;
        }

        .hero-nav__shell {
          position: relative;
          min-height: var(--nav-links-band-height);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .hero-nav__links-wrap {
          position: absolute;
          left: var(--hero-source-left, calc(50% - 18px));
          top: calc(50% + var(--nav-letters-offset-y, 0px));
          transform: translate(-50%, -50%);
        }

        .hero-nav__overlay {
          position: fixed;
          inset: 0;
          z-index: 190;
          pointer-events: none;
          opacity: 0;
        }

        .hero-nav__overlay-wrap {
          position: fixed;
          left: var(--hero-overlay-left, 50vw);
          top: var(
            --hero-overlay-top,
            calc(
              100vh - (var(--nav-links-band-height, 72px) / 2) +
                var(--nav-letters-offset-y, 0px)
            )
          );
          width: max-content;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .hero-nav__overlay-list {
          color: #111;
        }

        .hero-nav__links-list {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
        }

        .hero-imperio--nav-captured .hero-nav__overlay {
          opacity: var(--hero-overlay-opacity, 1);
        }

        .hero-imperio--nav-captured .hero-nav__overlay-wrap {
          pointer-events: auto;
        }

        .hero-imperio--nav-captured .hero-nav__links-list {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        body.side-menu-open .hero-imperio__nav,
        body.side-menu-open .hero-nav__overlay {
          opacity: 0 !important;
          visibility: hidden;
          pointer-events: none !important;
        }

        .hero-imperio--wordmark-ready .hero-imperio__wordmark {
          opacity: 1;
          transform: translateY(0);
        }

        .hero-imperio--wordmark-ready .hero-imperio__imperio-part {
          opacity: var(--imperio-opacity);
          transform: translate(var(--imperio-x), var(--imperio-y));
        }

        .hero-imperio--wordmark-ready .hero-imperio__espanol-part {
          opacity: var(--espanol-opacity);
          transform: translate(var(--espanol-x), var(--espanol-y));
          filter: none;
        }

        .hero-imperio--latin-ready .hero-imperio__latin-layers {
          opacity: 1;
        }

        .hero-imperio--nav-ready .hero-imperio__nav {
          opacity: 1;
          transform: translateY(0);
        }

        .nav-link {
          --nav-hover-mark-size: clamp(0.78em, 0.7em + 0.18vw, 1em);
          --nav-hover-mark-gap: clamp(0.2rem, 0.34vw, 0.46rem);
          --nav-hover-mark-offset: clamp(0.12rem, 0.22vw, 0.3rem);
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 var(
            --nav-link-inline-padding,
            calc(var(--nav-hover-mark-gap) + var(--nav-hover-mark-size) * 0.55)
          );
        }

        .nav-link:hover,
        .nav-link:focus-visible {
          color: var(--color-red-accent);
        }

        .nav-link::before,
        .nav-link::after {
          content: '[';
          position: absolute;
          top: 50%;
          left: 0;
          transform: translate(calc(var(--nav-hover-mark-offset) * -1), -50%);
          color: var(--color-red-accent);
          opacity: 0;
          transition: opacity 0.3s ease, transform 0.3s ease;
          font-size: var(--nav-hover-mark-size);
          font-weight: 600;
          letter-spacing: 0.08em;
          line-height: 1;
          pointer-events: none;
        }

        .nav-link::after {
          content: ']';
          left: auto;
          right: 0;
          transform: translate(var(--nav-hover-mark-offset), -50%);
        }

        .nav-link:hover::before,
        .nav-link:hover::after,
        .nav-link:focus-visible::before,
        .nav-link:focus-visible::after {
          opacity: 1;
          transform: translate(0, -50%);
        }

        @media (min-width: 769px) and (max-width: 1180px) {
          .nav-link {
            --nav-hover-mark-size: 0.72em;
            --nav-hover-mark-gap: clamp(0.08rem, 0.2vw, 0.18rem);
            --nav-hover-mark-offset: 0.08rem;
          }
        }

        @media (min-width: 769px) and (max-width: 1279px) {
          .hero-nav__shell {
            min-height: calc(var(--space-unit) * 9);
            padding: var(--space-1) var(--space-2);
          }

          .hero-nav__links-wrap {
            position: static;
            width: 100%;
            transform: none;
          }

          .hero-nav__links-list {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-auto-rows: minmax(30px, auto);
            gap: 0.28rem 0.48rem;
            width: 100%;
            max-width: min(100%, 860px);
          }

          .hero-nav__links-list li {
            width: 100%;
            min-width: 0;
          }

          .hero-nav__links-list .nav-link {
            --nav-link-inline-padding: 0.12rem;
            width: 100%;
            min-height: 44px;
            font-size: 14px;
            letter-spacing: 0;
            line-height: 1.2;
            text-align: center;
            white-space: normal;
          }

          .hero-nav__links-list .nav-link::before,
          .hero-nav__links-list .nav-link::after,
          .hero-nav__overlay {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .hero-imperio {
            min-height: 100svh;
            background: var(--color-white-pure);
          }

          .hero-background__img {
            object-position: 50% 50%;
          }

          .hero-imperio__lockup {
            --wordmark-w: min(84vw, 360px);
            left: 50%;
            top: 46%;
            transform: translate(-50%, -50%);
          }

          .hero-imperio__lockup {
            gap: var(--space-2);
          }

          .hero-imperio__latin-wrap,
          .hero-imperio__latin-block {
            width: min(92vw, 360px);
            max-width: calc(100vw - var(--space-4));
            overflow: hidden;
          }

          .hero-imperio__nav {
            display: block;
            opacity: 1;
            transform: none;
          }

          .hero-nav__surface {
            background: var(--color-white-pure);
            border-top: 0;
            box-shadow: none;
          }

          .hero-nav__shell {
            min-height: auto;
            padding-block: var(--space-2);
          }

          .hero-nav__links-wrap {
            position: static;
            width: 100%;
            transform: none;
          }

          .hero-nav__overlay {
            display: none;
          }

          .hero-nav__links-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            grid-auto-rows: minmax(34px, auto);
            gap: 3px var(--space-1);
            width: 100%;
            max-width: 100%;
          }

          .hero-nav__links-list li {
            width: 100%;
          }

          .nav-link {
            min-height: 44px;
            width: 100%;
            padding-inline: var(--space-1);
            font-size: 13px;
            letter-spacing: 0;
            line-height: 1.2;
            white-space: normal;
            text-align: center;
          }

          .nav-link::before,
          .nav-link::after {
            display: none;
          }
        }

        @media (min-width: 769px) {
          .hero-background__img {
            object-fit: fill;
          }
        }

      `}</style>
    </>
  );
}
