import { getGlyphClusterRect, toRectObject } from "./dom";

const NAV_PROGRESS_SMOOTHING = 0.14;
const NAV_FALLBACK_SCROLL_PX = 220;
const NAV_MIN_TRIGGER_DISTANCE_PX = 120;
const NAV_MAX_TRIGGER_DISTANCE_PX = 520;

const clamp01 = (value) => Math.min(1, Math.max(0, value));
const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3);

export const createNavController = ({
  nav,
  mobileMenuBtn,
  mobileBreakpoint,
  heroSection,
  heroNav,
  heroNavSurface,
  heroNavLinksWrap,
  mainNavInner,
  mainNavLinksWrap,
  reducedMotion,
}) => {
  if (nav?.hasAttribute("data-persistent")) {
    nav.removeAttribute("data-scroll-hidden");
    return { start() {}, stop() {}, syncLayout() {}, update() {} };
  }
  let navStartDistance = NAV_FALLBACK_SCROLL_PX;
  let navTargetProgress = 0;
  let navProgress = 0;
  let animationFrameId = 0;
  let heroOverlayDockX = 0;
  let heroOverlayDockY = 0;

  const resetDockedLinks = () => {
    if (!nav) return;
    nav.style.setProperty("--nav-links-progress", "0");
    nav.classList.remove("main-nav--merged");
  };

  const resetNavMergeState = () => {
    resetDockedLinks();
  };

  const getNavLettersRect = () =>
    getGlyphClusterRect(heroNavLinksWrap) ?? getGlyphClusterRect(heroNavSurface) ?? null;

  const syncHeroOverlayPosition = () => {
    if (!heroSection || !heroNav) return;
    if (!mobileBreakpoint.matches) {
      heroSection.style.removeProperty("--hero-source-left");
      return;
    }

    const linksWrapRect = toRectObject(
      mainNavLinksWrap?.getBoundingClientRect?.() ??
        mainNavInner?.getBoundingClientRect?.() ??
        nav?.getBoundingClientRect?.() ??
        heroNav.getBoundingClientRect()
    );
    const navRect = nav?.getBoundingClientRect?.();

    if (
      !linksWrapRect ||
      linksWrapRect.height <= 0 ||
      linksWrapRect.width <= 0 ||
      !navRect ||
      navRect.height <= 0
    ) {
      return;
    }

    heroOverlayDockX = linksWrapRect.left + linksWrapRect.width / 2;
    heroOverlayDockY = Math.max(0, navRect.top) + navRect.height / 2;
    const sourceRect = getNavLettersRect();
    const wrapRect = heroNavLinksWrap?.getBoundingClientRect();
    const parentRect = heroNavLinksWrap?.offsetParent?.getBoundingClientRect();
    if (sourceRect && wrapRect && parentRect) {
      // Align the original text with its dock before the scroll handoff.
      const glyphOffset = sourceRect.left + sourceRect.width / 2 - (wrapRect.left + wrapRect.width / 2);
      heroSection.style.setProperty("--hero-source-left", `${heroOverlayDockX - parentRect.left - glyphOffset}px`);
    }
  };

  const releaseHeroOverlay = () => {
    resetNavMergeState();
    heroSection?.classList.remove("hero-imperio--nav-captured");
  };

  const pinHeroOverlay = (x, y) => {
    if (!heroSection) return;

    heroSection.style.setProperty("--hero-overlay-opacity", "1");
    heroSection.style.setProperty("--hero-overlay-left", `${x.toFixed(2)}px`);
    heroSection.style.setProperty("--hero-overlay-top", `${y.toFixed(2)}px`);
    resetDockedLinks();
    heroSection.classList.add("hero-imperio--nav-captured");
  };

  const updateHeroOverlayPosition = (sourceRect) => {
    if (!heroSection) return;
    if (!mobileBreakpoint.matches) {
      releaseHeroOverlay();
      return;
    }

    const liveSourceRect =
      sourceRect ?? getGlyphClusterRect(heroNavLinksWrap) ?? getGlyphClusterRect(heroNavSurface);
    const navRect = nav?.getBoundingClientRect();

    if (!navRect || !liveSourceRect) {
      releaseHeroOverlay();
      return;
    }

    const sourceCenterX = liveSourceRect.left + liveSourceRect.width / 2;
    const sourceCenterY = liveSourceRect.top + liveSourceRect.height / 2;
    const hasNavbarContact =
      navRect.bottom >= liveSourceRect.top && navRect.top <= liveSourceRect.bottom;

    if (!hasNavbarContact && sourceCenterY > heroOverlayDockY) {
      releaseHeroOverlay();
      return;
    }

    if (sourceCenterY <= heroOverlayDockY) {
      pinHeroOverlay(heroOverlayDockX, heroOverlayDockY);
      return;
    }

    pinHeroOverlay(sourceCenterX, sourceCenterY);
  };

  const updateNavGradient = () => {
    if (!nav) return;

    const fluidProgress = navProgress * navProgress * (3 - 2 * navProgress);
    const gradientStop = 8 + 92 * fluidProgress;
    const topAlpha = 0.16 + 0.84 * fluidProgress;
    const bottomAlpha = Math.min(1, fluidProgress * fluidProgress);

    nav.style.setProperty("--nav-gradient-stop", `${gradientStop.toFixed(2)}%`);
    nav.style.setProperty("--nav-gradient-top-alpha", topAlpha.toFixed(3));
    nav.style.setProperty("--nav-gradient-bottom-alpha", bottomAlpha.toFixed(3));
    nav.style.setProperty("--nav-glass-alpha", (0.12 + fluidProgress * 0.24).toFixed(3));
    nav.style.setProperty("--nav-glass-line-alpha", (0.22 + fluidProgress * 0.3).toFixed(3));
    nav.style.setProperty(
      "--nav-glass-shadow-alpha",
      (0.08 + fluidProgress * 0.14).toFixed(3)
    );
  };

  const updateMenuButtonTone = () => {
    if (!nav || !mobileMenuBtn) return;

    const navRect = nav.getBoundingClientRect();
    const buttonRect = mobileMenuBtn.getBoundingClientRect();
    const fillFrontY = navRect.top + Math.max(1, navRect.height) * navProgress;
    const buttonCenterY = buttonRect.top + buttonRect.height / 2;

    nav.classList.toggle("main-nav--hamburger-dark", fillFrontY >= buttonCenterY);
  };

  const tick = () => {
    const delta = navTargetProgress - navProgress;
    navProgress =
      Math.abs(delta) > 0.0004
        ? navProgress + delta * NAV_PROGRESS_SMOOTHING
        : navTargetProgress;

    nav?.style.setProperty("--nav-progress", navProgress.toFixed(3));
    updateNavGradient();
    updateMenuButtonTone();
    animationFrameId = window.requestAnimationFrame(tick);
  };

  const recomputeNavStartDistance = () => {
    if (!nav) return;

    const navRect = nav.getBoundingClientRect();
    const sourceRect = getNavLettersRect();
    if (!sourceRect) {
      navStartDistance = NAV_FALLBACK_SCROLL_PX;
      return;
    }

    const initialGap = Math.max(0, sourceRect.top - navRect.bottom);
    navStartDistance = Math.min(
      NAV_MAX_TRIGGER_DISTANCE_PX,
      Math.max(NAV_MIN_TRIGGER_DISTANCE_PX, initialGap)
    );
  };

  const update = () => {
    if (!nav) return;

    const navRect = nav.getBoundingClientRect();
    const sourceRect = getNavLettersRect();

    const rawProgress = sourceRect
      ? 1 -
        clamp01(Math.max(0, sourceRect.top - navRect.bottom) / Math.max(1, navStartDistance))
      : clamp01(window.scrollY / NAV_FALLBACK_SCROLL_PX);

    navTargetProgress = easeOutCubic(rawProgress);

    if (!mobileBreakpoint.matches || !sourceRect || sourceRect.height <= 0) {
      resetNavMergeState();
    }

    updateHeroOverlayPosition(sourceRect);

    if (reducedMotion) {
      navProgress = navTargetProgress;
      nav.style.setProperty("--nav-progress", navProgress.toFixed(3));
      updateNavGradient();
      updateMenuButtonTone();
    }
  };

  return {
    start() {
      if (!reducedMotion) {
        animationFrameId = window.requestAnimationFrame(tick);
      }
    },
    stop() {
      if (animationFrameId) {
        window.cancelAnimationFrame(animationFrameId);
      }
    },
    syncLayout() {
      syncHeroOverlayPosition();
      recomputeNavStartDistance();
      update();
      if (!reducedMotion) {
        updateMenuButtonTone();
      }
    },
    update,
  };
};
