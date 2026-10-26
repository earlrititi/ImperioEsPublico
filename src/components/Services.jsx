import { useEffect, useRef, useState } from "preact/hooks";
import { EMAIL_MARKETING_CONSENT } from "../config/email-marketing";
import {
  PLAN_COMPARISON_INTRO,
  PLAN_COMPARISON_LABELS,
  SERVICES_ITEMS,
} from "../config/home";
import { TextHoverEffect } from "./ui/text-hover-effect";
import { withBase } from "../utils/basePath";
import {trackFunnel} from "../lib/funnel-client";

const FOUNDATION_CARDS = [
  {
    title: "Nuestra Historia",
    description:
      "Donde nunca se ponía el sol. Una historia de descubrimientos, hazañas y legado que cambió el mundo para siempre. Un linaje de exploradores, conquistadores y visionarios que se atrevieron a soñar más allá de lo conocido, dejando una marca imborrable en la historia de la humanidad.",
  },
  {
    title: "Forma parte",
    description:
      "Descarga el manifiesto del Imperio Español y descubre nuestras publicaciones de historia y divulgación. Con Arcabucero accedes a los artículos para suscriptores y obtienes un 15% de descuento en la Camiseta Imperial para cada lanzamiento. El foro estará disponible próximamente.",
  },
];

const SERVICE_CARD_MEDIA = {
  "01": {
    base: "card-1",
    morph: "card-1-morph",
  },
  "02": {
    base: "card-2",
    morph: "card-2-morph",
  },
  "03": {
    base: "card-3",
    morph: "card-3-morph",
  },
};

export default function Services() {
  const [isManifestFormOpen, setIsManifestFormOpen] = useState(false);
  const [manifestFirstName, setManifestFirstName] = useState("");
  const [manifestEmail, setManifestEmail] = useState("");
  const [manifestCompany, setManifestCompany] = useState("");
  const [manifestPrivacy, setManifestPrivacy] = useState(false);
  const [manifestMarketing,setManifestMarketing]=useState(false);
  const manifestRequestIdRef = useRef(null);
  const [manifestStatus, setManifestStatus] = useState("idle");
  const [manifestError, setManifestError] = useState("");
  const manifestModalRef = useRef(null);
  const manifestFirstNameInputRef = useRef(null);
  const isManifestFormReady = Boolean(
    manifestPrivacy && manifestFirstName.trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(manifestEmail.trim())
  );

  useEffect(() => {
    const cards = Array.from(
      document.querySelectorAll("[data-service-card-morph]")
    );
    const cleanups = [];
    const morphRequests = new WeakMap();
    const armySwap = document.querySelector(".services-army-swap");
    const resetCard = (card) => {
      card.classList.remove(
        "service-cta-card--locked-open",
        "service-cta-card--morph-active"
      );
    };
    const visibilityObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (entry.isIntersecting) morphRequests.get(entry.target)?.("low");
              });
            },
            { rootMargin: "320px 0px", threshold: 0 }
          );

    const resetObserver =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              entries.forEach((entry) => {
                if (!entry.isIntersecting) resetCard(entry.target);
              });
            },
            { threshold: 0 }
          );

    if (armySwap) {
      armySwap.querySelectorAll("[data-army-base-srcset]").forEach((source) => {
        source.setAttribute("srcset", source.getAttribute("data-army-base-srcset") || "");
        source.removeAttribute("data-army-base-srcset");
      });
      const armyBaseImage = armySwap.querySelector("[data-army-base-src]");
      const armyBaseSrc = armyBaseImage?.getAttribute("data-army-base-src");
      if (armyBaseImage && armyBaseSrc) {
        armyBaseImage.setAttribute("src", armyBaseSrc);
        armyBaseImage.removeAttribute("data-army-base-src");
      }

      let armyHoverRequested = false;
      const requestArmyHover = () => {
        if (armyHoverRequested) return;
        armyHoverRequested = true;

        armySwap.querySelectorAll("[data-army-srcset]").forEach((source) => {
          source.setAttribute("srcset", source.getAttribute("data-army-srcset") || "");
          source.removeAttribute("data-army-srcset");
        });

        const image = armySwap.querySelector("[data-army-src]");
        const src = image?.getAttribute("data-army-src");
        if (!image || !src) return;
        image.setAttribute("src", src);
        image.removeAttribute("data-army-src");
        image
          .decode()
          .catch(() => undefined)
          .finally(() => armySwap.classList.add("services-army-swap--hover-ready"));
      };

      armySwap.addEventListener("pointerenter", requestArmyHover);
      armySwap.addEventListener("pointerdown", requestArmyHover);
      cleanups.push(() => {
        armySwap.removeEventListener("pointerenter", requestArmyHover);
        armySwap.removeEventListener("pointerdown", requestArmyHover);
      });
    }

    cards.forEach((card) => {
      let requested = false;

      const requestMorph = (priority = "low") => {
        const image = card.querySelector("[data-morph-src]");
        if (image && priority === "high") image.fetchPriority = "high";
        if (requested) return;
        requested = true;

        card.querySelectorAll("[data-morph-srcset]").forEach((source) => {
          const srcset = source.getAttribute("data-morph-srcset");
          if (srcset) source.setAttribute("srcset", srcset);
          source.removeAttribute("data-morph-srcset");
        });

        const src = image?.getAttribute("data-morph-src");
        if (!image || !src) return;

        image.fetchPriority = priority;
        image.setAttribute("src", src);
        image.removeAttribute("data-morph-src");
        image
          .decode()
          .catch(() => undefined)
          .finally(() => card.classList.add("service-cta-card--morph-ready"));
      };

      const lockCardOpen = () => {
        requestMorph("high");
        card.classList.add(
          "service-cta-card--locked-open",
          "service-cta-card--morph-active"
        );
      };

      morphRequests.set(card, requestMorph);

      card.addEventListener("pointerenter", lockCardOpen);
      card.addEventListener("focusin", lockCardOpen);
      card.addEventListener("pointerdown", lockCardOpen);
      visibilityObserver?.observe(card);
      resetObserver?.observe(card);

      cleanups.push(() => {
        card.classList.remove(
          "service-cta-card--locked-open",
          "service-cta-card--morph-active",
          "service-cta-card--morph-ready"
        );
        card.removeEventListener("pointerenter", lockCardOpen);
        card.removeEventListener("focusin", lockCardOpen);
        card.removeEventListener("pointerdown", lockCardOpen);
        visibilityObserver?.unobserve(card);
        resetObserver?.unobserve(card);
      });
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
      visibilityObserver?.disconnect();
      resetObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isManifestFormOpen) return;

    if (manifestModalRef.current && !manifestModalRef.current.open) {
      manifestModalRef.current.showModal();
    }

    manifestFirstNameInputRef.current?.focus();
  }, [isManifestFormOpen]);

  const handleManifestSubmit = async (event) => {
    event.preventDefault();
    if (!isManifestFormReady || manifestStatus === "submitting") return;

    setManifestStatus("submitting");
    setManifestError("");

    try {
      manifestRequestIdRef.current ||= crypto.randomUUID();
      const response = await fetch("/api/manifesto.php", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          firstName: manifestFirstName,
          email: manifestEmail,
          company: manifestCompany,
          source: "home",
          anonymousId: manifestRequestIdRef.current,
          requestId: manifestRequestIdRef.current,
          privacyAcknowledged: manifestPrivacy,
          marketingConsent:manifestMarketing,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "No se pudo enviar el manifiesto.");
      }

      setManifestStatus("sent");
      void trackFunnel("manifesto",4);
      manifestRequestIdRef.current = null;
      setManifestFirstName("");
      setManifestEmail("");
      setManifestCompany("");
      setManifestMarketing(false);
      setManifestPrivacy(false);
    } catch (error) {
      setManifestStatus("idle");
      setManifestError(error.message || "No se pudo enviar el manifiesto.");
    }
  };

  const activateService = (service) => {
    const destination = service.actionHref || service.subscriptionHref;
    if (destination) window.location.assign(destination);
  };

  return (
    <>
      <section class="services-section home-section bg-white">
        <div class="home-shell">
          <div class="section-header services-section__header text-center fade-in-up">
            <h2 class="services-title font-rosa-black text-center">
              <span class="services-title__secondary block">DUE&Ntilde;OS DEL MAR</span>
              <span class="services-title__primary block">SE&Ntilde;ORES DEL MUNDO</span>
            </h2>
            <div class="services-army-swap">
              <div class="services-army-hitbox" aria-hidden="true"></div>
              <picture class="services-army-picture services-army-picture--default">
                <source
                  type="image/avif"
                  data-army-base-srcset={`${withBase("/images/ejercito-blanco_upscaled_2x-960.avif")} 960w, ${withBase("/images/ejercito-blanco_upscaled_2x-1440.avif")} 1440w`}
                  sizes="(max-width: 767px) calc(100vw - 32px), min(72vw, 1440px)"
                />
                <img
                  data-army-base-src={withBase("/images/ejercito-blanco_upscaled_2x.webp")}
                  alt="Formacion historica del ejercito español"
                  width="1960"
                  height="1424"
                  class="services-army-image"
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                />
              </picture>
              <picture class="services-army-picture services-army-picture--hover">
                <source
                  type="image/avif"
                  data-army-srcset={`${withBase("/images/ejercito-rojo-960.avif")} 960w, ${withBase("/images/ejercito-rojo-1440.avif")} 1440w`}
                  sizes="(max-width: 767px) calc(100vw - 32px), min(72vw, 1440px)"
                />
                <img
                  data-army-src={withBase("/images/ejercito-rojo.webp")}
                  alt=""
                  aria-hidden="true"
                  width="1960"
                  height="1424"
                  class="services-army-image"
                  loading="lazy"
                  decoding="async"
                  fetchpriority="low"
                />
              </picture>
            </div>
            <div class="services-foundation-grid services-foundation-grid--before-button fade-in-up">
            {FOUNDATION_CARDS.slice(0, 1).map((card) => (
              <article class="services-foundation-card" key={card.title}>
                <h3 class="services-foundation-card__title">
                  <TextHoverEffect text={card.title} duration={0.72} />
                </h3>
                <p class="services-foundation-card__copy">{card.description}</p>
              </article>
            ))}
          </div>
          </div>

          <div class="services-next-button-wrap services-next-button-wrap--between-foundation">
            <button
              class="services-next-button"
              type="button"
              aria-controls="services-manifest-modal"
              aria-expanded={isManifestFormOpen}
              data-funnel-manifesto
              onClick={() => setIsManifestFormOpen(true)}
            >
              <span class="services-next-button__label">RECIBE EL MANIFIESTO</span>
              <span class="services-next-button__chevron" aria-hidden="true"></span>
            </button>
          </div>

          <div class="services-foundation-grid services-foundation-grid--after-button fade-in-up">
            {FOUNDATION_CARDS.slice(1).map((card) => (
              <article class="services-foundation-card" key={card.title}>
                <h3 class="services-foundation-card__title">
                  <TextHoverEffect text={card.title} duration={0.72} />
                </h3>
                <p class="services-foundation-card__copy">{card.description}</p>
              </article>
            ))}
          </div>

          {isManifestFormOpen && (
            <dialog
              class="services-manifest-modal"
              id="services-manifest-modal"
              aria-labelledby="services-manifest-modal-title"
              ref={manifestModalRef}
              onCancel={(event) => event.preventDefault()}
            >
              <form class="services-manifest-modal__panel" data-funnel-flow="manifesto" method="dialog" onSubmit={handleManifestSubmit}>
                <h2 class="services-manifest-modal__title" id="services-manifest-modal-title">
                  {manifestStatus === "sent" ? "Manifiesto enviado" : "Recibe el manifiesto"}
                </h2>
                {manifestStatus === "sent" ? (
                  <>
                    <p class="services-manifest-modal__message" role="status">
                      Te hemos enviado el PDF a tu correo. Revisa tambien la carpeta de spam o promociones.
                    </p>
                    <button
                      class="services-manifest-modal__submit"
                      type="button"
                      onClick={() => {
                        manifestModalRef.current?.close();
                        setIsManifestFormOpen(false);
                        setManifestStatus("idle");
                        setManifestError("");
                      }}
                    >
                      Cerrar
                    </button>
                  </>
                ) : (
                  <>
                    <input
                      ref={manifestFirstNameInputRef}
                      class="services-manifest-modal__field"
                      type="text"
                      name="firstName"
                      placeholder="Nombre"
                      aria-label="Nombre"
                      autocomplete="given-name"
                      maxlength={80}
                      value={manifestFirstName}
                      onInput={(event) => setManifestFirstName(event.currentTarget.value)}
                      required
                    />
                    <input
                      class="services-manifest-modal__field"
                      type="email"
                      name="email"
                      placeholder={"\u00a1Dinos tu correo!"}
                      aria-label={"\u00a1Dinos tu correo!"}
                      autocomplete="email"
                      value={manifestEmail}
                      onInput={(event) => setManifestEmail(event.currentTarget.value)}
                      required
                    />
                    <input
                      class="services-manifest-modal__trap"
                      type="text"
                      name="company"
                      value={manifestCompany}
                      onInput={(event) => setManifestCompany(event.currentTarget.value)}
                      autocomplete="organization"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    {manifestError && (
                      <p class="services-manifest-modal__error" role="alert">
                        {manifestError}
                      </p>
                    )}
                    <label class="services-manifest-modal__privacy">
                      <input type="checkbox" checked={manifestPrivacy} required onChange={(event) => setManifestPrivacy(event.currentTarget.checked)} />
                      <span>He leído la <a href="/legal/privacidad">política de privacidad</a> para recibir el manifiesto.</span>
                    </label>
                    <label class="services-manifest-modal__privacy"><input type="checkbox" checked={manifestMarketing} onChange={e=>setManifestMarketing(e.currentTarget.checked)}/><span>{EMAIL_MARKETING_CONSENT} Opcional; baja en cualquier momento.</span></label>
                    <button
                      class="services-manifest-modal__submit"
                      type="submit"
                      disabled={!isManifestFormReady || manifestStatus === "submitting"}
                    >
                      {manifestStatus === "submitting" ? "Enviando..." : manifestMarketing ? "Recibir manifiesto y newsletter" : "Recibir manifiesto"}
                    </button>
                    <button
                      class="services-manifest-modal__close"
                      type="button"
                      onClick={() => {
                        manifestModalRef.current?.close();
                        setIsManifestFormOpen(false);
                        setManifestStatus("idle");
                        setManifestError("");
                      }}
                    >
                      Cerrar
                    </button>
                  </>
                )}
              </form>
            </dialog>
          )}

          <div class="services-grid" style={{ "--services-comparison-row-count": PLAN_COMPARISON_LABELS.length }}>
            <aside class="services-plan-index fade-in-up" aria-labelledby="services-plan-index-title">
              <div class="services-plan-index__header">
                <h3 class="services-plan-index__title" id="services-plan-index-title">
                  Planes
                </h3>
                <div class="services-plan-index__item services-plan-index__item--intro">
                  <span class="services-plan-index__intro-sizer" aria-hidden="true">
                    {PLAN_COMPARISON_INTRO}
                  </span>
                  <picture class="services-plan-index__intro-picture">
                    <source
                      type="image/avif"
                      srcSet={`${withBase("/images/imagen-planes-640.avif")} 640w, ${withBase("/images/imagen-planes-1024.avif")} 1024w`}
                      sizes="(max-width: 767px) 92vw, 34vw"
                    />
                    <img
                      class="services-plan-index__intro-image"
                      src={withBase("/images/imagen-planes.webp")}
                      alt="Desembarco historico con la bandera espanola"
                      width="1254"
                      height="1254"
                      loading="lazy"
                      decoding="async"
                      fetchpriority="low"
                    />
                  </picture>
                </div>
              </div>
              <ul class="services-plan-index__list">
                {PLAN_COMPARISON_LABELS.map((label) => (
                  <li class="services-plan-index__item" key={label}>
                    {label}
                  </li>
                ))}
              </ul>
            </aside>
            {SERVICES_ITEMS.map((service) => {
              const cardMedia = SERVICE_CARD_MEDIA[service.id];
              const cardImageSrc = cardMedia
                ? `/images/${cardMedia.base}.webp`
                : null;
              const cardImageAvifSrcSet = cardMedia
                ? [768, 1440]
                    .map(
                      (width) =>
                        `${withBase(`/images/${cardMedia.base}-${width}.avif`)} ${width}w`
                    )
                    .join(", ")
                : null;
              const cardMorphSrc = cardMedia
                ? `/images/${cardMedia.morph}.webp`
                : null;
              const cardMorphAvifSrcSet = cardMedia
                ? [768, 1440]
                    .map(
                      (width) =>
                        `${withBase(`/images/${cardMedia.morph}-${width}.avif`)} ${width}w`
                    )
                    .join(", ")
                : null;
              const serviceStatLabel = service.statLabel || service.id;
              const comparisonHighlights = PLAN_COMPARISON_LABELS.map(
                (_, index) => service.highlights?.[index] || ""
              );

              if (service.highlights?.length) {
                return (
                  <article
                    class={`service-cta-card fade-in-up${cardImageSrc ? " service-cta-card--image-bg" : ""}${service.priceBadge ? " service-cta-card--has-price" : ""}`}
                    data-stat-counter-group
                    data-service-card-morph={cardMorphSrc || undefined}
                    onClick={(event) => {
                      if (event.target.closest("a, button")) return;
                      activateService(service);
                    }}
                    key={service.id}
                  >
                    {cardImageSrc && (
                      <span class="service-cta-card__media" aria-hidden="true">
                        <picture class="service-cta-card__media-picture service-cta-card__media-picture--base">
                          <source
                            type="image/avif"
                            srcSet={cardImageAvifSrcSet}
                            sizes="(max-width: 767px) calc(100vw - 32px), min(1100px, calc(100vw - 64px))"
                          />
                          <img
                            class="service-cta-card__media-image"
                            src={withBase(cardImageSrc)}
                            alt=""
                            width="1672"
                            height="941"
                            loading="lazy"
                            decoding="async"
                            fetchpriority="low"
                          />
                        </picture>
                        {cardMorphSrc && (
                          <picture class="service-cta-card__media-picture service-cta-card__media-picture--morph">
                            <source
                              type="image/avif"
                              data-morph-srcset={cardMorphAvifSrcSet}
                              sizes="(max-width: 767px) calc(100vw - 32px), min(1100px, calc(100vw - 64px))"
                            />
                            <img
                              class="service-cta-card__media-image"
                              data-morph-src={withBase(cardMorphSrc)}
                              alt=""
                              width="1672"
                              height="941"
                              decoding="async"
                              fetchpriority="low"
                            />
                          </picture>
                        )}
                      </span>
                    )}
                    <span class="service-cta-card__stat-rail" aria-hidden="true"></span>
                    <span class="service-cta-card__event-bg" aria-hidden="true"></span>
                    <span class="service-cta-card__grid-pattern" aria-hidden="true"></span>
                    <span class="service-cta-card__bg" aria-hidden="true"></span>
                    {service.priceBadge && (
                      <span class="service-cta-card__price-flag">{service.priceBadge}</span>
                    )}
                    <div class="service-cta-card__body">
                      <span
                        class="service-number service-cta-card__number"
                        data-stat-counter
                        data-stat-value={serviceStatLabel}
                        data-stat-duration="920"
                      >
                        {serviceStatLabel}
                      </span>
                      <h3 class="service-cta-card__title">
                        <TextHoverEffect text={service.title} duration={0.78} />
                      </h3>
                      <p class="service-cta-card__copy">{service.description}</p>
                      {service.actionHref ? (
                        <a
                          class="service-cta-card__button"
                          href={service.actionHref}
                        >
                          <span>Empezar</span>
                          <span class="service-cta-card__button-arrow" aria-hidden="true">-&gt;</span>
                        </a>
                      ) : (
                        <a
                          class="service-cta-card__button"
                          href={service.subscriptionHref}
                        >
                          <span>{service.subscriptionLabel || "Suscribirme"}</span>
                          <span class="service-cta-card__button-arrow" aria-hidden="true">-&gt;</span>
                        </a>
                      )}
                    </div>
                    <ul class="service-cta-card__list" aria-label={`Puntos clave de ${service.title}`}>
                      {comparisonHighlights.map((highlight, index) => {
                        const isEmpty = !highlight;
                        const isUnavailable = highlight === "-";
                        const comparisonLabel = PLAN_COMPARISON_LABELS[index];

                        return (
                          <li
                            class={`service-cta-card__list-item${isEmpty ? " service-cta-card__list-item--empty" : ""}`}
                            key={`${service.id}-highlight-${index}`}
                          >
                            <span class="service-cta-card__value">
                              {!isEmpty && (
                                <>
                                  <span
                                    class={`service-cta-card__check${isUnavailable ? " service-cta-card__check--unavailable" : ""}`}
                                    aria-hidden="true"
                                  >
                                    {isUnavailable ? (
                                      <img
                                        src={withBase("/images/subscription-x-brush.webp")}
                                        alt=""
                                        width="128"
                                        height="128"
                                        loading="lazy"
                                        decoding="async"
                                      />
                                    ) : (
                                      "\u2713"
                                    )}
                                  </span>
                                  {!isUnavailable && (
                                    <span class="service-cta-card__value-text">{highlight}</span>
                                  )}
                                </>
                              )}
                            </span>
                            <span class="service-cta-card__plan-label">
                              {comparisonLabel}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                );
              }

              const contentClassName = [
                "service-content",
                service.reverseOnDesktop && "md:order-2",
              ]
                .filter(Boolean)
                .join(" ");
              const imageClassName = [
                "service-image relative overflow-hidden rounded-lg",
                service.reverseOnDesktop && "md:order-1",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <div class="service-item grid md:grid-cols-2 gap-12 items-center fade-in-up" key={service.id}>
                  <div class={contentClassName}>
                    <h3 class="text-4xl font-bold mb-6">
                      <TextHoverEffect text={service.title} duration={0.78} />
                    </h3>
                    <p class="text-lg leading-relaxed text-black/70">{service.description}</p>
                  </div>
                  <div class={imageClassName}>
                    <img
                      src={service.imageSrc}
                      alt={service.imageAlt}
                      class="w-full h-[400px] object-cover hover-scale"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <style>{`
        @property --services-next-angle-1 {
          syntax: "<angle>";
          inherits: false;
          initial-value: -75deg;
        }

        @property --services-next-angle-2 {
          syntax: "<angle>";
          inherits: false;
          initial-value: -45deg;
        }

        .services-section {
          padding-block: calc(var(--home-section-space) * 0.72) calc(var(--home-section-space) * 0.62);
        }

        .service-number {
          font-variant-numeric: lining-nums;
          letter-spacing: 0.1em;
          margin-bottom: var(--space-2);
        }

        .services-title {
          color: var(--color-black-pure);
          display: grid;
          justify-items: center;
          letter-spacing: 0.01em;
          line-height: 1;
          margin-bottom: 0;
          margin-top: var(--services-title-offset-y);
          overflow-wrap: anywhere;
          transition: color 0.35s ease;
        }

        .services-title__primary {
          font-size: var(--services-title-primary-size);
        }

        .services-title__secondary {
          font-size: var(--services-title-secondary-size);
        }

        .services-title span + span {
          margin-top: 0.04em;
        }

        .services-section__header {
          display: grid;
          gap: 0;
          margin-bottom: var(--space-2);
        }

        .services-grid {
          display: grid;
          gap: var(--space-4);
          position: relative;
        }

        .services-plan-index {
          display: none;
        }

        .service-cta-card {
          --service-glow-hsl: 356 78% 49%;
          --service-card-bg-start: rgba(255, 255, 255, 0.78);
          --service-card-bg-mid: hsl(var(--service-glow-hsl) / 0.12);
          --service-card-bg-end: hsl(var(--service-glow-hsl) / 0.2);
          --service-card-bg-base: hsl(var(--service-glow-hsl) / 0.08);
          --service-card-copy-color: rgba(0, 0, 0, 0.68);
          --service-card-check-color: hsl(var(--service-glow-hsl));
          --service-stat-rail-color: hsl(var(--service-glow-hsl));
          --service-button-bg: hsl(var(--service-glow-hsl) / 0.96);
          --service-button-bg-hover: hsl(var(--service-glow-hsl) / 1);
          --service-button-bg-active: hsl(var(--service-glow-hsl) / 0.88);
          --service-button-text-color: var(--color-white-pure);
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: var(--space-4);
          align-items: center;
          width: 100%;
          min-height: clamp(176px, 16vw, 220px);
          padding: clamp(var(--space-3), 4.8vw, var(--space-8));
          border-radius: calc(var(--space-2) * 1.25);
          border: 1px solid hsl(var(--service-glow-hsl) / 0.14);
          background:
            linear-gradient(145deg, var(--service-card-bg-start) 0%, var(--service-card-bg-mid) 52%, var(--service-card-bg-end) 100%),
            var(--service-card-bg-base);
          color: var(--color-black-pure);
          position: relative;
          z-index: 0;
          overflow: hidden;
          isolation: isolate;
          box-shadow:
            0 6px 6px rgba(0, 0, 0, 0.14),
            0 18px 38px -28px rgba(0, 0, 0, 0.44),
            0 0 22px rgba(0, 0, 0, 0.08),
            0 0 0 1px hsl(var(--service-glow-hsl) / 0.12),
            inset 1px 1px 0 rgba(255, 255, 255, 0.54);
          content-visibility: auto;
          contain-intrinsic-size: auto 220px;
          cursor: pointer;
          transition:
            transform 0.38s cubic-bezier(0.22, 1, 0.36, 1),
            border-color 0.2s ease;
          will-change: transform;
        }

        .service-cta-card::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 4;
          border-radius: inherit;
          pointer-events: none;
          border: 1px solid rgba(255, 255, 255, 0.6);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.42), transparent 34%),
            linear-gradient(315deg, hsl(var(--service-glow-hsl) / 0.12), transparent 38%);
          box-shadow:
            inset 2px 2px 1px rgba(255, 255, 255, 0.44),
            inset -1px -1px 1px rgba(255, 255, 255, 0.32);
          opacity: 0.92;
        }

        .service-cta-card__stat-rail,
        .service-cta-card__bg,
        .service-cta-card__event-bg,
        .service-cta-card__grid-pattern {
          position: absolute;
          pointer-events: none;
        }

        .service-cta-card__media {
          position: absolute;
          inset: 0;
          z-index: 0;
          overflow: hidden;
          border-radius: inherit;
          opacity: 0;
          pointer-events: none;
          transform: scale(1.018);
          transition:
            opacity 0.22s ease,
            transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
          will-change: opacity, transform;
        }

        .service-cta-card__media::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 2;
          background: linear-gradient(
            180deg,
            rgba(0, 0, 0, 0.08),
            rgba(0, 0, 0, 0.5)
          );
        }

        .service-cta-card__media-picture,
        .service-cta-card__media-image {
          position: absolute;
          inset: 0;
          display: block;
          width: 100%;
          height: 100%;
        }

        .service-cta-card__media-picture--base {
          z-index: 0;
        }

        .service-cta-card__media-picture--morph {
          z-index: 1;
          opacity: 0;
          transform: scale(1.025);
          transition:
            opacity 0.42s ease,
            transform 0.72s cubic-bezier(0.175, 0.885, 0.32, 1.08);
        }

        .service-cta-card__media-image {
          object-fit: cover;
          object-position: center;
        }

        .service-cta-card__stat-rail {
          top: 0;
          bottom: 0;
          left: 0;
          z-index: 5;
          width: 5px;
          border-radius: inherit;
          background: var(--service-stat-rail-color);
          box-shadow:
            0 0 16px color-mix(in srgb, var(--service-stat-rail-color) 42%, transparent),
            0 0 34px color-mix(in srgb, var(--service-stat-rail-color) 22%, transparent);
          transform: scaleY(0);
          transform-origin: center;
          transition: transform 0.26s ease;
          will-change: transform;
        }

        .service-cta-card__event-bg {
          inset: 0;
          z-index: 0;
          border-radius: inherit;
          background:
            radial-gradient(
              34rem 24rem at 50% 50%,
              hsl(var(--service-glow-hsl) / 0.18),
              transparent 68%
            ),
            linear-gradient(135deg, hsl(var(--service-glow-hsl) / 0.2) 0%, rgba(255, 255, 255, 0.06) 52%, hsl(var(--service-glow-hsl) / 0.1) 100%);
          transform: scale(1);
          transform-origin: center;
          transition: transform 0.34s ease, opacity 0.22s ease;
          will-change: transform, opacity;
        }

        .service-cta-card__grid-pattern {
          inset: 0;
          z-index: 2;
          border-radius: inherit;
          background-image:
            linear-gradient(hsl(var(--service-glow-hsl) / 0.08) 1px, transparent 1px),
            linear-gradient(90deg, hsl(var(--service-glow-hsl) / 0.08) 1px, transparent 1px);
          background-size: 30px 30px;
          opacity: 0;
          transition: opacity 0.22s ease;
          will-change: opacity;
        }

        .service-cta-card__bg {
          inset: 0;
          z-index: 1;
          border-radius: inherit;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.1) 58%, hsl(var(--service-glow-hsl) / 0.08)),
            hsl(var(--service-glow-hsl) / 0.04),
            rgba(255, 255, 255, 0.16);
          outline: 0;
          overflow: hidden;
          opacity: 1;
          filter: none;
          box-shadow: none;
          transform: none;
          transition: opacity 0.16s ease;
        }

        .service-cta-card:is(
          :hover,
          :focus-within,
          .service-cta-card--locked-open
        ) {
          min-height: clamp(236px, 21vw, 300px);
          transform: translateY(-4px);
          border-color: hsl(var(--service-glow-hsl) / 0.42);
          background:
            linear-gradient(163deg, rgba(255, 255, 255, 0.38) 0%, rgba(255, 255, 255, 0.18) 42%, hsl(var(--service-glow-hsl) / 0.16) 100%),
            hsl(var(--service-glow-hsl) / 0.06),
            rgba(255, 255, 255, 0.2);
          box-shadow:
            0 0 24px hsl(var(--service-glow-hsl) / 0.12),
            0 18px 36px -26px rgba(0, 0, 0, 0.42),
            inset 1px 1px 0 rgba(255, 255, 255, 0.5);
        }

        .service-cta-card:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__stat-rail {
          transform: scaleY(1);
        }

        .service-cta-card:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__event-bg {
          transform: scale(1.05);
        }

        .service-cta-card:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__grid-pattern {
          opacity: 1;
        }

        .service-cta-card:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__bg {
          opacity: 1;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.13) 58%, hsl(var(--service-glow-hsl) / 0.1)),
            hsl(var(--service-glow-hsl) / 0.04),
            rgba(255, 255, 255, 0.18);
          border-radius: inherit;
          transform: none;
        }

        .service-cta-card__body {
          display: grid;
          justify-items: start;
          gap: var(--space-2);
          max-width: 58ch;
          position: relative;
          z-index: 3;
        }

        .service-cta-card__number {
          margin-bottom: 0;
          color: hsl(var(--service-glow-hsl));
          font-family: var(--font-display);
          font-size: clamp(3.15rem, 6vw, 4.8rem);
          font-weight: 800;
          line-height: 0.86;
          text-shadow:
            0 0 10px hsl(var(--service-glow-hsl) / 0.24),
            0 0 24px hsl(var(--service-glow-hsl) / 0.12);
          transition: color 0.3s ease, text-shadow 0.3s ease;
        }

        .service-cta-card__price-flag {
          position: absolute;
          top: 0;
          right: clamp(var(--space-2), 2.6vw, var(--space-4));
          z-index: 5;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: clamp(3.47rem, 6.67vw, 4.8rem);
          min-height: clamp(3.1rem, 5.6vw, 4.25rem);
          padding: 0.55rem 0.52rem 0.92rem;
          clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%);
          background:
            linear-gradient(135deg, rgba(255, 255, 255, 0.36), transparent 34%),
            linear-gradient(180deg, #f5d46a 0%, #d5a329 56%, #9a6a08 100%);
          color: #1a1203;
          box-shadow:
            0 12px 24px rgba(77, 49, 0, 0.24),
            inset 1px 1px 0 rgba(255, 255, 255, 0.54),
            inset -1px -1px 0 rgba(90, 55, 0, 0.26);
          font-family: var(--font-display);
          font-size: clamp(0.74rem, 1.55vw, 0.92rem);
          font-weight: 900;
          line-height: 1.05;
          text-align: center;
          text-transform: uppercase;
          text-wrap: balance;
          transform: translateY(-1px);
          transition:
            color 0.3s ease,
            filter 0.3s ease,
            transform 0.3s ease;
        }

        .service-cta-card__title {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.95rem, 3.65vw, 2.85rem);
          font-weight: 800;
          line-height: 1;
          letter-spacing: 0;
          color: var(--color-black-pure);
        }

        .service-cta-card__copy {
          margin: 0;
          padding: 0 0.8rem;
          border-radius: 4px;
          color: var(--service-card-copy-color);
          background: rgba(18, 18, 18, 0.06);
          font-size: clamp(0.96rem, 1.12vw, 1.16rem);
          line-height: 1.48;
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          box-sizing: border-box;
          transform: translateY(-0.35rem);
          transition:
            max-height 0.34s ease,
            padding 0.34s ease,
            opacity 0.2s ease,
            transform 0.34s ease;
        }

        .service-cta-card:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__copy {
          max-height: 32rem;
          padding: 0.7rem 0.8rem;
          opacity: 1;
          transform: translateY(0);
        }

        .service-cta-card__button {
          position: relative;
          isolation: isolate;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          min-height: 50px;
          margin-top: var(--space-2);
          padding: 0.88rem 1.18rem;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--space-1);
          background:
            radial-gradient(
              12rem 8rem at 50% 50%,
              hsl(var(--service-glow-hsl) / 0.2),
              transparent 58%
            ),
            var(--service-button-bg);
          color: var(--service-button-text-color);
          font-weight: 800;
          line-height: 1;
          text-decoration: none;
          box-shadow:
            0 0 0 1px hsl(var(--service-glow-hsl) / 0),
            0 0 0 hsl(var(--service-glow-hsl) / 0);
          transition:
            transform 0.18s ease,
            border-color 0.18s ease;
        }

        .service-cta-card:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__button {
          border-color: hsl(var(--service-glow-hsl) / 0.72);
          background:
            radial-gradient(
              12rem 8rem at 50% 50%,
              hsl(var(--service-glow-hsl) / 0.44),
              transparent 58%
            ),
            var(--service-button-bg-hover);
          box-shadow:
            0 0 0 1px hsl(var(--service-glow-hsl) / 0.44),
            0 0 22px hsl(var(--service-glow-hsl) / 0.34),
            0 0 48px hsl(var(--service-glow-hsl) / 0.16),
            inset 0 1px 0 rgba(255, 255, 255, 0.28);
        }

        .service-cta-card__button > span {
          position: relative;
          z-index: 1;
        }

        .service-cta-card__button:hover {
          transform: translateY(-1px);
        }

        .service-cta-card__button:disabled {
          cursor: wait;
          opacity: 0.68;
          transform: none;
        }

        .service-cta-card__button:active {
          transform: translateY(1px) scale(0.965);
          border-color: hsl(var(--service-glow-hsl) / 0.92);
          background:
            radial-gradient(
              10rem 7rem at 50% 50%,
              hsl(var(--service-glow-hsl) / 0.62),
              transparent 58%
            ),
            var(--service-button-bg-active);
          box-shadow:
            0 0 0 1px hsl(var(--service-glow-hsl) / 0.62),
            0 0 16px hsl(var(--service-glow-hsl) / 0.28),
            inset 0 3px 10px rgba(0, 0, 0, 0.52),
            inset 0 1px 0 rgba(255, 255, 255, 0.16);
        }

        .service-cta-card__button-arrow {
          font-size: 1.2em;
          line-height: 0.8;
        }

        .service-cta-card__list {
          display: grid;
          gap: 0;
          justify-self: start;
          width: 100%;
          margin: 0;
          padding: 0;
          list-style: none;
          font-size: clamp(1rem, 1.35vw, 1.18rem);
          font-weight: 800;
          line-height: 1.25;
          position: relative;
          z-index: 3;
          max-height: 0;
          opacity: 0;
          overflow: hidden;
          transform: translateX(-0.75rem);
          transition:
            max-height 0.38s ease,
            opacity 0.22s ease,
            transform 0.38s ease;
        }

        .service-cta-card:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__list {
          max-height: 64rem;
          opacity: 1;
          transform: translateX(0);
        }

        .service-cta-card__list-item {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(7rem, 38%);
          align-items: stretch;
          min-width: 0;
          min-height: 4.25rem;
          border-top: 1px solid hsl(var(--service-glow-hsl) / 0.24);
        }

        .service-cta-card__list-item--empty {
          display: grid;
        }

        .service-cta-card__value {
          display: grid;
          grid-template-columns: 1.3rem minmax(0, 1fr);
          align-items: center;
          gap: 0.7rem;
          min-width: 0;
          padding: 0.72rem 0.8rem 0.72rem 0;
        }

        .service-cta-card__value-text {
          min-width: 0;
          line-height: 1.18;
          overflow-wrap: anywhere;
          text-wrap: pretty;
        }

        .service-cta-card__plan-label {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          min-width: 0;
          padding: 0.72rem 0.68rem;
          border-left: 1px solid rgba(255, 255, 255, 0.24);
          background: rgba(18, 18, 18, 0.06);
          color: var(--color-white-pure);
          font-family: var(--font-serif);
          font-size: clamp(0.72rem, 1vw, 0.9rem);
          font-weight: 800;
          line-height: 1.12;
          text-align: right;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }

        .service-cta-card__check {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--service-card-check-color);
          font-size: 1.05rem;
          font-weight: 800;
          line-height: 1;
        }

        .service-cta-card__check.service-cta-card__check--unavailable {
          color: #c62828;
          font-size: 1em;
        }

        .service-cta-card__check--unavailable {
          width: 1em;
          height: 1em;
        }

        .service-cta-card__check--unavailable img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 2px 2px #fff);
        }

        .services-next-button-wrap {
          --services-next-hover-time: 700ms;
          --services-next-hover-ease: cubic-bezier(0.175, 0.885, 0.32, 2.2);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(0.7rem, 1.6vw, 1rem);
          margin: var(--space-4) 0 var(--space-8);
          position: relative;
          border-radius: 2rem;
          transition: transform var(--services-next-hover-time) var(--services-next-hover-ease);
        }

        .services-manifest-modal {
          position: fixed;
          inset: 50% auto auto 50%;
          transform: translate(-50%, -50%);
          width: min(calc(100vw - 2rem), 520px);
          max-height: calc(100dvh - 2rem);
          margin: 0;
          border: 0;
          border-radius: 24px;
          background: transparent;
          color: inherit;
          padding: 0;
          overflow: visible;
          z-index: 10000;
        }

        .services-manifest-modal:not([open]) {
          display: none !important;
        }

        .services-manifest-modal::backdrop {
          background:
            radial-gradient(circle at 50% 44%, rgb(242 56 30 / 20%), transparent 32rem),
            rgb(11 12 12 / 78%);
          backdrop-filter: blur(8px);
        }

        .services-manifest-modal__panel {
          display: grid;
          gap: 1rem;
          width: 100%;
          border: 1px solid rgba(255, 255, 255, 0.26);
          border-radius: 24px;
          background-color: var(--color-black-papers);
          background-image:
            var(--imperio-dot-pattern),
            linear-gradient(145deg, rgb(11 12 12 / 96%), rgba(64, 10, 15, 0.94));
          background-size: var(--imperio-dot-pattern-size), auto;
          box-shadow:
            0 28px 80px rgba(0, 0, 0, 0.52),
            0 0 0 6px rgb(242 56 30 / 12%),
            inset 1px 1px 0 rgba(255, 255, 255, 0.12);
          max-height: calc(100dvh - 2rem);
          overflow-y: auto;
          padding: clamp(1.2rem, 4vw, 2rem);
        }

        .services-manifest-modal__title {
          color: var(--color-white-pure);
          font-family: var(--font-serif);
          font-size: clamp(2rem, 7vw, 3.15rem);
          line-height: 1;
          margin: 0 0 0.35rem;
          text-align: center;
        }

        .services-manifest-modal__field {
          width: 100%;
          min-height: clamp(3.45rem, 6vw, 4.1rem);
          border: 2px solid rgb(242 56 30 / 82%);
          border-radius: 18px;
          background: rgba(255, 249, 241, 0.98);
          color: #1a0f0c;
          box-shadow:
            0 12px 28px rgba(0, 0, 0, 0.28),
            inset 1px 1px 0 rgba(255, 255, 255, 0.86);
          font: inherit;
          font-size: clamp(1.04rem, 1.7vw, 1.24rem);
          font-weight: 800;
          letter-spacing: 0;
          line-height: 1.2;
          outline: none;
          padding: 1rem 1.2rem;
          text-align: center;
        }

        .services-manifest-modal__field::placeholder {
          color: rgba(26, 15, 12, 0.76);
          opacity: 1;
        }

        .services-manifest-modal__field:focus {
          border-color: var(--color-red-accent);
          box-shadow:
            0 0 0 7px rgb(242 56 30 / 24%),
            0 18px 42px rgba(0, 0, 0, 0.34),
            inset 1px 1px 0 rgba(255, 255, 255, 0.9);
        }

        .services-manifest-modal__trap {
          position: absolute;
          width: 1px;
          height: 1px;
          margin: -1px;
          border: 0;
          padding: 0;
          clip: rect(0 0 0 0);
          clip-path: inset(50%);
          overflow: hidden;
          white-space: nowrap;
        }

        .services-manifest-modal__privacy { display:flex;align-items:flex-start;gap:10px;color:#fff;font-size:14px;line-height:1.5; }
        .services-manifest-modal__privacy input { flex:0 0 auto;width:20px;height:20px;accent-color:var(--color-red-accent); }
        .services-manifest-modal__privacy a { text-decoration:underline; }

        .services-manifest-modal__error,
        .services-manifest-modal__message {
          margin: 0;
          color: rgba(255, 255, 255, 0.86);
          font-size: 0.92rem;
          font-weight: 700;
          line-height: 1.35;
          text-align: center;
        }

        .services-manifest-modal__message {
          font-size: clamp(1rem, 1.7vw, 1.18rem);
        }

        .services-manifest-modal__submit {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          min-height: 3.35rem;
          margin-top: 0.2rem;
          border: 0;
          border-radius: 999px;
          background: var(--color-red-accent);
          color: var(--color-white-pure);
          cursor: pointer;
          font: inherit;
          font-weight: 800;
          letter-spacing: 0;
          transition: opacity 0.2s ease, filter 0.2s ease, transform 0.2s ease;
        }

        .services-manifest-modal__submit:disabled {
          cursor: not-allowed;
          filter: grayscale(1);
          opacity: 0.46;
          transform: none;
        }

        .services-manifest-modal__submit:not(:disabled):hover {
          transform: translateY(-1px);
        }

        .services-manifest-modal__close {
          justify-self: center;
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.74);
          cursor: pointer;
          font: inherit;
          font-size: 0.92rem;
          font-weight: 800;
          padding: 0.2rem 0.6rem;
        }

        .services-manifest-modal__close:hover {
          color: var(--color-white-pure);
        }

        .service-cta-card:nth-of-type(1) {
          --service-glow-hsl: 0 0% 7%;
          --service-card-bg-start: rgba(250, 250, 250, 0.86);
          --service-card-bg-mid: hsl(0 0% 7% / 0.1);
          --service-card-bg-end: hsl(0 0% 7% / 0.22);
          --service-card-bg-base: hsl(0 0% 7% / 0.08);
          --service-stat-rail-color: hsl(0 0% 58%);
          --service-button-bg: hsl(0 0% 7%);
          --service-button-bg-hover: hsl(0 0% 0%);
          --service-button-bg-active: hsl(0 0% 4%);
        }

        .service-cta-card:nth-of-type(2) {
          --service-glow-hsl: 356 78% 45%;
          --service-card-bg-start: rgba(255, 248, 248, 0.84);
          --service-card-bg-mid: hsl(356 78% 45% / 0.14);
          --service-card-bg-end: hsl(356 78% 45% / 0.26);
          --service-card-bg-base: hsl(356 78% 45% / 0.1);
          --service-button-bg: hsl(356 78% 42%);
          --service-button-bg-hover: hsl(356 82% 48%);
          --service-button-bg-active: hsl(356 74% 34%);
        }

        .service-cta-card:nth-of-type(3) {
          --service-glow-hsl: 43 82% 48%;
          --service-card-bg-start: rgba(255, 252, 239, 0.86);
          --service-card-bg-mid: hsl(43 82% 48% / 0.18);
          --service-card-bg-end: hsl(43 82% 48% / 0.32);
          --service-card-bg-base: hsl(43 82% 48% / 0.12);
          --service-button-bg: hsl(43 82% 52%);
          --service-button-bg-hover: hsl(43 88% 58%);
          --service-button-bg-active: hsl(43 74% 43%);
          --service-button-text-color: var(--color-black-pure);
        }

        .service-cta-card--image-bg:is(
          :hover,
          :focus-within,
          .service-cta-card--locked-open
        ) {
          --service-card-copy-color: rgba(255, 255, 255, 0.86);
          --service-card-check-color: var(--color-white-pure);
          --service-button-text-color: hsl(var(--service-glow-hsl));
          color: var(--color-white-pure);
          background-color: var(--color-black-papers);
          background-image: var(--imperio-dot-pattern);
          background-size: var(--imperio-dot-pattern-size);
        }

        .service-cta-card--image-bg .service-cta-card__grid-pattern {
          display: none;
        }

        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__event-bg,
        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__bg {
          opacity: 0;
        }

        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__media {
          opacity: 1;
          transform: scale(1);
        }

        .service-cta-card--image-bg.service-cta-card--morph-ready.service-cta-card--morph-active
          .service-cta-card__media-picture--morph {
          animation: service-card-morph-cycle 1.08s ease forwards;
        }

        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__number,
        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__price-flag,
        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__title,
        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .text-hover-effect__base {
          color: var(--color-white-pure);
        }

        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__price-flag {
          color: #1a1203;
          filter: saturate(1.12) brightness(1.04);
          transform: translateY(-1px) scale(1.03);
        }

        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .text-hover-effect__gradient,
        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .text-hover-effect__outline {
          opacity: 0;
        }

        .service-cta-card--image-bg:is(
            :hover,
            :focus-within,
            .service-cta-card--locked-open
          )
          .service-cta-card__button {
          border-color: rgba(255, 255, 255, 0.76);
          background:
            radial-gradient(
              11rem 7rem at 50% 50%,
              rgba(255, 255, 255, 0.82),
              rgba(255, 255, 255, 0.52) 58%,
              rgba(255, 255, 255, 0.34)
            ),
            rgba(255, 255, 255, 0.9);
          color: hsl(var(--service-glow-hsl));
          box-shadow:
            0 0 0 1px rgba(255, 255, 255, 0.36),
            0 0 22px rgba(255, 255, 255, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.7);
        }

        .service-cta-card--image-bg:hover .service-cta-card__button:active,
        .service-cta-card--image-bg:focus-within .service-cta-card__button:active {
          background:
            radial-gradient(
              10rem 7rem at 50% 50%,
              rgba(255, 255, 255, 0.72),
              rgba(255, 255, 255, 0.42) 58%,
              rgba(255, 255, 255, 0.28)
            ),
            rgba(255, 255, 255, 0.82);
        }

        .services-foundation-grid {
          display: grid;
          gap: clamp(var(--space-3), 1.6vw, var(--space-6));
          grid-template-columns: minmax(0, 1fr);
          position: relative;
          z-index: 5;
          margin-top: calc(var(--space-10) * -0.58);
          margin-bottom: var(--space-4);
        }

        .services-foundation-card {
          position: relative;
          display: grid;
          align-content: start;
          justify-items: center;
          gap: var(--space-2);
          width: 100%;
          padding: clamp(var(--space-3), 3.2vw, var(--space-6)) 0;
          text-align: center;
          overflow: visible;
          isolation: isolate;
          border: 0;
          border-radius: 0;
          background: transparent;
          box-shadow: none;
          backdrop-filter: none;
          -webkit-backdrop-filter: none;
          transition:
            color 0.7s cubic-bezier(0.175, 0.885, 0.32, 2.2),
            opacity 0.7s cubic-bezier(0.175, 0.885, 0.32, 2.2);
        }

        .services-foundation-card:hover {
          box-shadow: none;
        }

        .services-foundation-card__title {
          font-family: var(--font-serif);
          font-size: clamp(2.4rem, 4.2vw, 5.1rem);
          font-weight: 700;
          letter-spacing: 0.01em;
          line-height: 1.05;
          margin: 0;
          color: var(--color-black-pure);
          position: relative;
          z-index: 2;
        }

        .services-foundation-card__copy {
          max-width: 86ch;
          margin: 0 auto;
          color: rgba(0, 0, 0, 0.62);
          font-size: clamp(1.2rem, 1.55vw, 1.72rem);
          font-weight: 600;
          line-height: 1.28;
          text-wrap: balance;
          position: relative;
          z-index: 2;
        }

        .services-army-swap {
          --army-hitbox-width: 62%;
          --army-hitbox-height: 56%;
          position: relative;
          width: min(100%, 980px);
          margin: calc(var(--space-3) * -0.45) auto calc(var(--space-10) * -0.4);
        }

        .services-army-hitbox {
          position: absolute;
          left: 50%;
          top: 50%;
          z-index: 4;
          width: var(--army-hitbox-width);
          height: var(--army-hitbox-height);
          transform: translate(-50%, -50%);
          background: transparent;
        }

        .service-item {
          gap: var(--space-4);
        }

        .service-content h3 {
          margin-bottom: var(--space-3);
        }

        .services-army-picture {
          display: block;
          width: 100%;
          aspect-ratio: 1960 / 1424;
          position: relative;
          z-index: 1;
        }

        .services-army-picture--default,
        .services-army-picture--hover {
          transition: opacity 0.3s ease;
        }

        .services-army-picture--hover {
          position: absolute;
          inset: 0;
          opacity: 0;
          pointer-events: none;
          z-index: 2;
        }

        .services-army-swap--hover-ready .services-army-hitbox:hover ~ .services-army-picture--default {
          opacity: 0;
        }

        .services-army-swap--hover-ready .services-army-hitbox:hover ~ .services-army-picture--hover {
          opacity: 1;
        }

        .services-army-image {
          display: block;
          width: 100%;
          height: auto;
        }

        .services-title:hover {
          color: var(--color-red-accent);
        }

        @media (min-width: 960px) {
          .services-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            align-items: stretch;
            gap: clamp(var(--space-2), 2vw, var(--space-4));
          }

          .service-cta-card {
            grid-template-columns: minmax(0, 1fr);
            grid-template-rows: auto minmax(0, 1fr);
            align-content: start;
            align-items: start;
            min-height: clamp(34rem, 48vw, 46rem);
            padding: clamp(var(--space-3), 2.4vw, var(--space-5, 40px));
          }

          .service-cta-card__body {
            align-content: start;
            width: 100%;
            max-width: none;
          }

          .service-cta-card__number {
            font-size: clamp(2.4rem, 3.8vw, 4.2rem);
          }

          .service-cta-card__title {
            display: flex;
            align-items: flex-start;
            min-height: 2em;
            font-size: clamp(1.85rem, 2.6vw, 2.75rem);
            text-wrap: balance;
          }

          .service-cta-card__copy {
            font-size: clamp(0.94rem, 1vw, 1.08rem);
          }

          .service-cta-card:is(
              :hover,
              :focus-within,
              .service-cta-card--locked-open
            )
            .service-cta-card__copy {
            max-height: 24rem;
          }

          .service-cta-card__button {
            width: 100%;
          }

          .service-cta-card__list {
            align-self: start;
            justify-self: stretch;
            width: 100%;
            font-size: clamp(0.94rem, 1.05vw, 1.08rem);
          }

          .service-cta-card:is(
              :hover,
              :focus-within,
              .service-cta-card--locked-open
            )
            .service-cta-card__list {
            max-height: 48rem;
          }

          .service-cta-card__list-item {
            grid-template-columns: minmax(0, 1fr);
            min-height: 4.5rem;
          }

          .service-cta-card__list-item--empty {
            display: none;
          }

          .service-cta-card__plan-label {
            display: none;
          }

          .service-item {
            gap: var(--space-6);
          }

          .services-foundation-grid {
            grid-template-columns: minmax(0, 1fr);
            margin-top: calc(var(--space-12) * -0.6);
            margin-bottom: var(--space-3);
          }

          .services-foundation-card {
            padding: clamp(var(--space-4), 3.4vw, var(--space-8)) 0;
          }

          .services-army-swap {
            margin-top: calc(var(--space-4) * -0.4);
            margin-bottom: calc(var(--space-12) * -0.5);
          }
        }

        @media (min-width: 1180px) {
          .services-grid {
            --services-comparison-row-height: clamp(3.625rem, 3.5vw, 4.125rem);
            grid-template-columns: minmax(190px, 0.72fr) repeat(3, minmax(0, 1fr));
            grid-template-rows: auto auto;
            align-items: stretch;
            gap: clamp(var(--space-2), 1.55vw, var(--space-4));
            row-gap: var(--space-4);
          }

          .services-plan-index {
            display: grid;
            grid-row: span 2;
            grid-template-rows: subgrid;
            align-content: start;
            min-height: clamp(34rem, 48vw, 46rem);
            padding: clamp(var(--space-3), 2.4vw, var(--space-5, 40px));
            overflow: hidden;
            border: 1px solid rgba(0, 0, 0, 0.13);
            border-radius: calc(var(--space-2) * 1.25);
            background:
              linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(248, 246, 243, 0.88)),
              var(--color-white-off);
            box-shadow:
              0 6px 6px rgba(0, 0, 0, 0.1),
              0 18px 38px -28px rgba(0, 0, 0, 0.34),
              inset 1px 1px 0 rgba(255, 255, 255, 0.74);
          }

          .services-plan-index__title {
            margin: 0;
            padding: 0 0 clamp(1rem, 1.6vw, 1.45rem);
            border-bottom: 1px solid rgba(0, 0, 0, 0.14);
            color: var(--color-black-pure);
            font-family: var(--font-serif);
            font-size: clamp(2rem, 2.8vw, 3.1rem);
            font-weight: 700;
            line-height: 1;
            text-transform: uppercase;
          }

          .services-plan-index__header {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr);
          }

          .services-plan-index__list {
            display: grid;
            grid-template-rows: repeat(var(--services-comparison-row-count), var(--services-comparison-row-height));
            min-height: 0;
            margin: 0;
            padding: 0;
            list-style: none;
          }

          .services-plan-index__item {
            display: flex;
            align-items: center;
            min-width: 0;
            padding-block: 0.58rem;
            border-top: 1px solid rgba(0, 0, 0, 0.12);
            color: var(--color-black-pure);
            font-family: var(--font-serif);
            font-size: clamp(1rem, 1.28vw, 1.28rem);
            font-weight: 700;
            line-height: 1.08;
            text-wrap: balance;
          }

          .services-plan-index__item--intro {
            position: relative;
            align-items: flex-start;
            padding-block: 1rem;
            overflow: hidden;
            border: 0;
            font-family: var(--font-display);
            font-size: clamp(0.72rem, 0.78vw, 0.82rem);
            font-weight: 500;
            line-height: 1.35;
            overflow-wrap: anywhere;
            text-wrap: pretty;
          }

          .services-plan-index__intro-sizer {
            display: block;
            width: 100%;
            visibility: hidden;
          }

          .services-plan-index__intro-picture {
            display: contents;
          }

          .services-plan-index__intro-image {
            position: absolute;
            inset: 0;
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: 76% center;
          }

          .service-cta-card {
            grid-row: span 2;
            grid-template-rows: subgrid;
            align-content: start;
            content-visibility: visible;
          }

          .service-cta-card:is(:hover, :focus-within, .service-cta-card--locked-open) {
            min-height: clamp(34rem, 48vw, 46rem);
            transform: none;
          }

          .service-cta-card__body {
            align-self: stretch;
            grid-template-rows: auto auto 1fr auto;
          }

          .service-cta-card__copy,
          .service-cta-card:is(:hover, :focus-within, .service-cta-card--locked-open) .service-cta-card__copy {
            align-self: start;
            max-height: none;
            padding: 0.7rem 0.8rem;
          }

          .service-cta-card__list {
            grid-template-rows: repeat(var(--services-comparison-row-count), var(--services-comparison-row-height));
            align-self: start;
            gap: 0;
            font-size: clamp(0.84rem, 1.06vw, 1.06rem);
            line-height: 0.92;
          }

          .service-cta-card:is(
              :hover,
              :focus-within,
              .service-cta-card--locked-open
            )
            .service-cta-card__list {
            max-height: 96rem;
          }

          .service-cta-card__list-item,
          .service-cta-card__list-item--empty {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            min-height: var(--services-comparison-row-height);
            height: var(--services-comparison-row-height);
            padding-block: 0;
            overflow: hidden;
          }

          .service-cta-card__check {
            font-size: 0.82rem;
          }

          .service-cta-card__value {
            grid-template-columns: 0.8rem minmax(0, 1fr);
            gap: 0.35rem;
            padding: 0;
          }

          .service-cta-card__value-text {
            font-size: clamp(0.78rem, 0.88vw, 0.98rem);
            line-height: 1.12;
          }

        }

        @media (max-width: 959px) {
          .services-army-swap { width:100%; margin:1rem auto; overflow:hidden; }
          .services-army-picture { aspect-ratio:1960 / 1200; overflow:hidden; }
          .services-army-image { width:125%; max-width:none; margin-left:-12.5%; margin-top:-7%; }
        }

        @media (max-width: 767px) {
          .services-section {
            padding-block: var(--space-6) var(--space-8);
          }

          .services-section__header {
            margin-bottom: var(--space-6);
          }

          .services-title {
            letter-spacing: 0;
            line-height: 1.12;
            overflow: visible;
          }

          .services-title__primary,
          .services-title__secondary {
            padding-top: 0.14em;
            overflow: visible;
          }

          .services-army-swap {
            width: 100%;
            margin: var(--space-2) auto;
          }

          .services-foundation-grid {
            margin-top: var(--space-2);
            margin-bottom: var(--space-6);
          }

          .services-foundation-card {
            padding: var(--space-3) 0;
          }

          .services-foundation-card__title {
            font-size: clamp(2rem, 10vw, 2.85rem);
          }

          .services-foundation-card__copy {
            max-width: 100%;
            font-size: 1.12rem;
            line-height: 1.34;
          }

          .service-content h3 {
            font-size: clamp(2rem, 10vw, 2.75rem);
            margin-bottom: var(--space-2);
          }

          .services-grid {
            gap: calc(var(--space-unit) * 7);
          }

          .service-cta-card {
            min-height: auto;
            padding: var(--space-3) calc(var(--space-unit) * 2.5);
          }

          .service-cta-card--has-price {
            padding-top: calc(var(--space-3) + 1rem);
          }

          .service-cta-card__price-flag {
            right: calc(var(--space-unit) * 2);
            width: 3.47rem;
            min-width: 0;
            min-height: 3rem;
            font-size: 0.72rem;
          }

          .service-cta-card__button {
            width: 100%;
          }

          .service-cta-card__list {
            width: 100%;
          }

          .service-cta-card__list-item {
            grid-template-columns: minmax(0, 1fr) minmax(7.1rem, 38%);
          }

          .services-next-button-wrap {
            margin: var(--space-2) 0 var(--space-6);
          }

          .service-item {
            grid-template-columns: minmax(0, 1fr);
            gap: var(--space-3);
          }

          .service-image img {
            height: clamp(260px, 76vw, 360px);
          }
        }

        .services-foundation-grid--before-button {
          margin-bottom: 0;
        }

        .services-foundation-grid--after-button {
          margin-top: 0;
          margin-bottom: var(--space-4);
        }

        .services-foundation-grid--after-button .services-foundation-card {
          padding-top: clamp(var(--space-2), 2vw, var(--space-4));
        }

        .services-next-button-wrap--between-foundation {
          margin: clamp(var(--space-2), 1.8vw, var(--space-4)) 0;
        }

        @keyframes service-card-morph-cycle {
          0%,
          75% {
            opacity: 0;
            transform: scale(1.025);
          }

          100% {
            opacity: 1;
            transform: scale(1);
          }
        }

        /* Red glass manifesto CTA: static finish with lightweight interaction feedback. */
        .services-next-button-wrap,
        .services-next-button-wrap:has(.services-next-button:active) {
          transform: none;
          transition: none;
        }

        .services-next-button {
          position: relative;
          z-index: 3;
          isolation: isolate;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          align-items: center;
          gap: 0.65rem;
          width: min(100%, 22rem);
          min-width: 0;
          min-height: 4.65rem;
          padding: 0.75rem 1.15rem;
          overflow: hidden;
          border: 1px solid rgba(255, 239, 242, 0.44);
          border-radius: 1.65rem;
          background:
            linear-gradient(180deg, rgba(255, 255, 255, 0.34) 0%, rgba(255, 255, 255, 0.1) 34%, rgba(74, 0, 9, 0.17) 100%),
            linear-gradient(105deg, rgba(220, 24, 49, 0.76), rgba(151, 0, 23, 0.66));
          color: #fff;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.68),
            inset 0 -2px 0 rgba(255, 128, 146, 0.24),
            inset 0 0 18px rgba(255, 255, 255, 0.08),
            0 0 0 1px rgba(255, 65, 91, 0.2),
            0 12px 24px rgba(75, 0, 13, 0.3),
            0 4px 18px rgba(255, 42, 72, 0.24);
          -webkit-backdrop-filter: blur(16px) saturate(1.35);
          backdrop-filter: blur(16px) saturate(1.35);
          appearance: none;
          cursor: pointer;
          font: 700 clamp(0.86rem, 1.2vw, 1.02rem) / 1.1 var(--font-body);
          letter-spacing: 0.025em;
          text-decoration: none;
          text-shadow: 0 1px 3px rgba(70, 0, 10, 0.62);
          animation: none;
          transform: none;
          transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
        }

        .services-next-button::before {
          content: "";
          position: absolute;
          z-index: -1;
          inset: 1px 1px auto;
          height: 52%;
          border-radius: 1.55rem 1.55rem 52% 52%;
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0));
          pointer-events: none;
        }

        .services-next-button__label,
        .services-next-button__chevron {
          position: relative;
          z-index: 1;
        }

        .services-next-button__label {
          grid-column: 2;
          min-width: 0;
          text-align: center;
          white-space: nowrap;
        }

        .services-next-button__chevron {
          grid-column: 3;
          justify-self: end;
          width: 1.05rem;
          height: 1.05rem;
          border-right: 3px solid rgba(255, 255, 255, 0.94);
          border-bottom: 3px solid rgba(255, 255, 255, 0.94);
          transform: translateY(-0.2rem) rotate(45deg);
        }

        .services-next-button:hover,
        .services-next-button:active {
          color: #fff;
          animation: none;
          outline: none;
        }

        @media (hover: hover) {
          .services-next-button:hover {
            border-color: rgba(255, 246, 248, 0.66);
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.82),
              inset 0 -2px 0 rgba(255, 151, 166, 0.34),
              inset 0 0 22px rgba(255, 255, 255, 0.12),
              0 0 0 1px rgba(255, 89, 112, 0.3),
              0 15px 28px rgba(75, 0, 13, 0.34),
              0 5px 24px rgba(255, 48, 78, 0.36);
            transform: translateY(-2px);
          }
        }

        .services-next-button:active,
        .services-next-button:hover:active {
          border-color: rgba(255, 224, 229, 0.48);
          box-shadow:
            inset 0 4px 10px rgba(62, 0, 11, 0.48),
            inset 0 -1px 0 rgba(255, 220, 226, 0.34),
            0 4px 9px rgba(75, 0, 13, 0.24),
            0 2px 10px rgba(255, 42, 72, 0.2);
          transform: translateY(2px) scale(0.985);
          transition-duration: 80ms;
        }

        .services-next-button:focus-visible {
          outline: 3px solid rgba(255, 85, 109, 0.42);
          outline-offset: 4px;
        }

        @media (max-width: 380px) {
          .services-next-button {
            gap: 0.5rem;
            padding-inline: 0.9rem;
            font-size: 0.8rem;
          }

          .services-next-button__chevron {
            width: 0.92rem;
            height: 0.92rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .services-next-button,
          .services-next-button:hover,
          .services-next-button:active {
            transform: none;
            transition: none;
          }

          .service-cta-card,
          .service-cta-card__stat-rail,
          .service-cta-card__bg,
          .service-cta-card__event-bg,
          .service-cta-card__media,
          .service-cta-card__media-picture--morph,
          .service-cta-card__grid-pattern {
            animation: none;
            transition: none;
          }

          .service-cta-card:is(:hover, .service-cta-card--locked-open) {
            transform: none;
          }

          .service-cta-card--image-bg.service-cta-card--morph-ready.service-cta-card--morph-active
            .service-cta-card__media-picture--morph {
            opacity: 1;
            transform: none;
            animation: none;
          }
        }
      `}</style>
    </>
  );
}
