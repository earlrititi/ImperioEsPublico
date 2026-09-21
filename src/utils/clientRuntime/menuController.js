const MENU_OPEN_ANIM_MS = 920;
const MENU_CLOSE_ANIM_MS = 920;
const SIDE_BAR_REVEAL_DELAY_MS = 120;
const NAV_FADE_DELAY_MS = 700;
const SIDE_BAR_HIDE_DELAY_MS = 1500;

const MENU_POSE_OPEN = [
  {
    progress: 0,
    top: { x: 3, y: 9, width: 14, angle: 0, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: 0, opacity: 1, origin: "50% 50%" },
    bottom: { x: 17, y: 23, width: 14, angle: 0, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.12,
    top: { x: 3, y: 9, width: 14, angle: 2, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -34, opacity: 1, origin: "50% 50%" },
    bottom: { x: 17, y: 23, width: 14, angle: 2, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.24,
    top: { x: 3, y: 9, width: 14, angle: 8, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -86, opacity: 1, origin: "50% 50%" },
    bottom: { x: 17, y: 23, width: 14, angle: 8, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.4,
    top: { x: 4, y: 8, width: 14, angle: 20, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -168, opacity: 1, origin: "50% 50%" },
    bottom: { x: 16, y: 24, width: 14, angle: 20, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.58,
    top: { x: 5, y: 8, width: 14, angle: 31, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -246, opacity: 1, origin: "50% 50%" },
    bottom: { x: 15, y: 24, width: 14, angle: 31, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.76,
    top: { x: 6, y: 7, width: 14, angle: 40, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -308, opacity: 1, origin: "50% 50%" },
    bottom: { x: 14, y: 25, width: 14, angle: 40, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 1,
    top: { x: 7, y: 6, width: 14, angle: 45, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -405, opacity: 1, origin: "50% 50%" },
    bottom: { x: 13, y: 26, width: 14, angle: 45, opacity: 1, origin: "100% 50%" },
  },
];

const MENU_POSE_CLOSE = [
  {
    progress: 0,
    top: { x: 7, y: 6, width: 14, angle: 45, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -405, opacity: 1, origin: "50% 50%" },
    bottom: { x: 13, y: 26, width: 14, angle: 45, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.16,
    top: { x: 6, y: 7, width: 14, angle: 40, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -350, opacity: 1, origin: "50% 50%" },
    bottom: { x: 14, y: 25, width: 14, angle: 40, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.34,
    top: { x: 5, y: 8, width: 14, angle: 30, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -270, opacity: 1, origin: "50% 50%" },
    bottom: { x: 15, y: 24, width: 14, angle: 30, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.56,
    top: { x: 4, y: 8, width: 14, angle: 18, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -174, opacity: 1, origin: "50% 50%" },
    bottom: { x: 16, y: 24, width: 14, angle: 18, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 0.8,
    top: { x: 3, y: 9, width: 14, angle: 7, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: -64, opacity: 1, origin: "50% 50%" },
    bottom: { x: 17, y: 23, width: 14, angle: 7, opacity: 1, origin: "100% 50%" },
  },
  {
    progress: 1,
    top: { x: 3, y: 9, width: 14, angle: 0, opacity: 1, origin: "0% 50%" },
    middle: { x: 3, y: 16, width: 28, angle: 0, opacity: 1, origin: "50% 50%" },
    bottom: { x: 17, y: 23, width: 14, angle: 0, opacity: 1, origin: "100% 50%" },
  },
];

const lerp = (from, to, t) => from + (to - from) * t;

const interpolateLinePose = (from, to, t) => ({
  x: lerp(from.x, to.x, t),
  y: lerp(from.y, to.y, t),
  width: lerp(from.width, to.width, t),
  angle: lerp(from.angle, to.angle, t),
  opacity: lerp(from.opacity, to.opacity, t),
  origin: to.origin ?? from.origin ?? "50% 50%",
});

const getMenuPoseAt = (frames, progress) => {
  if (progress <= frames[0].progress) return frames[0];

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const next = frames[index];
    if (progress > next.progress) continue;

    const localProgress =
      (progress - previous.progress) /
      Math.max(0.0001, next.progress - previous.progress);

    return {
      top: interpolateLinePose(previous.top, next.top, localProgress),
      middle: interpolateLinePose(previous.middle, next.middle, localProgress),
      bottom: interpolateLinePose(previous.bottom, next.bottom, localProgress),
    };
  }

  return frames[frames.length - 1];
};

const applyLinePose = (element, pose) => {
  if (!element) return;

  element.style.left = `${pose.x}px`;
  element.style.width = `${pose.width}px`;
  element.style.opacity = String(pose.opacity);
  element.style.transformOrigin = pose.origin ?? "50% 50%";
  element.style.transform = `translate3d(0, ${pose.y}px, 0) rotate(${pose.angle}deg)`;
};

const applyMenuPose = (elements, pose) => {
  applyLinePose(elements.menuIconTopLine, pose.top);
  applyLinePose(elements.menuIconMiddleLine, pose.middle);
  applyLinePose(elements.menuIconBottomLine, pose.bottom);
};

export const createMenuController = ({
  nav,
  mobileMenuBtn,
  mobileMenu,
  menuIconTopLine,
  menuIconMiddleLine,
  menuIconBottomLine,
  onMenuStateChange,
}) => {
  const menuIconElements = {
    menuIconTopLine,
    menuIconMiddleLine,
    menuIconBottomLine,
  };

  let menuIconAnimationFrameId = 0;
  let sideBarRevealTimeoutId = 0;
  let navFadeTimeoutId = 0;
  let sideBarHideTimeoutId = 0;
  let menuMediaHydrated = false;

  const prepareMedia = () => {
    if (menuMediaHydrated || !mobileMenu) return;
    const picture = mobileMenu.querySelector("[data-menu-media]");
    if (!(picture instanceof HTMLPictureElement)) return;

    picture.querySelectorAll("source[data-srcset]").forEach((source) => {
      source.srcset = source.dataset.srcset || "";
      delete source.dataset.srcset;
    });

    const image = picture.querySelector("img[data-src]");
    if (image instanceof HTMLImageElement) {
      image.src = image.dataset.src || "";
      delete image.dataset.src;
    }

    menuMediaHydrated = true;
  };

  const clearSideBarTimers = () => {
    if (sideBarRevealTimeoutId) {
      window.clearTimeout(sideBarRevealTimeoutId);
      sideBarRevealTimeoutId = 0;
    }

    if (navFadeTimeoutId) {
      window.clearTimeout(navFadeTimeoutId);
      navFadeTimeoutId = 0;
    }

    if (sideBarHideTimeoutId) {
      window.clearTimeout(sideBarHideTimeoutId);
      sideBarHideTimeoutId = 0;
    }
  };

  const setMenuButtonVisualState = (isOpen, animate = true) => {
    if (!mobileMenuBtn) return;

    mobileMenuBtn.classList.remove("is-opening", "is-closing");

    if (menuIconAnimationFrameId) {
      window.cancelAnimationFrame(menuIconAnimationFrameId);
      menuIconAnimationFrameId = 0;
    }

    if (!animate) {
      mobileMenuBtn.classList.toggle("is-active", isOpen);
      applyMenuPose(
        menuIconElements,
        isOpen
          ? MENU_POSE_OPEN[MENU_POSE_OPEN.length - 1]
          : MENU_POSE_CLOSE[MENU_POSE_CLOSE.length - 1]
      );
      return;
    }

    const keyframes = isOpen ? MENU_POSE_OPEN : MENU_POSE_CLOSE;
    const duration = isOpen ? MENU_OPEN_ANIM_MS : MENU_CLOSE_ANIM_MS;
    const startTime = performance.now();

    mobileMenuBtn.classList.add(isOpen ? "is-opening" : "is-closing");
    mobileMenuBtn.classList.toggle("is-active", isOpen);

    const tick = (now) => {
      const progress = Math.min(1, (now - startTime) / duration);
      applyMenuPose(menuIconElements, getMenuPoseAt(keyframes, progress));

      if (progress < 1) {
        menuIconAnimationFrameId = window.requestAnimationFrame(tick);
        return;
      }

      mobileMenuBtn.classList.remove("is-opening", "is-closing");
      menuIconAnimationFrameId = 0;
    };

    menuIconAnimationFrameId = window.requestAnimationFrame(tick);
  };

  const setMenuOpen = (isOpen, options = {}) => {
    const { animate = true } = options;
    const wasOpen = mobileMenuBtn?.getAttribute("aria-expanded") === "true";

    clearSideBarTimers();

    if (isOpen) {
      prepareMedia();
      nav?.classList.add("main-nav--menu-open");
      mobileMenu?.classList.add("side-bar--open");
      mobileMenu?.setAttribute("aria-hidden", "false");
      if (mobileMenu) mobileMenu.inert = false;
      mobileMenu?.querySelector("a[href]")?.focus({ preventScroll: true });
    } else {
      if (mobileMenu) mobileMenu.inert = true;
      if (wasOpen) mobileMenuBtn?.focus({ preventScroll: true });
      mobileMenu?.classList.remove("side-bar--revealed");
      nav?.classList.remove("main-nav--menu-revealed");
      nav?.classList.remove("main-nav--menu-fading");
      if (!animate) {
        nav?.classList.remove("main-nav--menu-open");
        mobileMenu?.classList.remove("side-bar--open");
        mobileMenu?.setAttribute("aria-hidden", "true");
        onMenuStateChange?.(false);
      } else {
        sideBarHideTimeoutId = window.setTimeout(() => {
          nav?.classList.remove("main-nav--menu-open");
          mobileMenu?.classList.remove("side-bar--open");
          mobileMenu?.setAttribute("aria-hidden", "true");
          onMenuStateChange?.(false);
          sideBarHideTimeoutId = 0;
        }, SIDE_BAR_HIDE_DELAY_MS);
      }
    }

    mobileMenuBtn?.setAttribute("aria-expanded", String(isOpen));
    mobileMenuBtn?.setAttribute("aria-label", isOpen ? "Cerrar menu" : "Abrir menu");

    setMenuButtonVisualState(isOpen, animate);

    if (isOpen) {
      onMenuStateChange?.(true);

      if (!animate) {
        nav?.classList.add("main-nav--menu-fading");
        nav?.classList.add("main-nav--menu-revealed");
        mobileMenu?.classList.add("side-bar--revealed");
      } else {
        sideBarRevealTimeoutId = window.setTimeout(() => {
          nav?.classList.add("main-nav--menu-revealed");
          mobileMenu?.classList.add("side-bar--revealed");
          sideBarRevealTimeoutId = 0;

          navFadeTimeoutId = window.setTimeout(() => {
            nav?.classList.add("main-nav--menu-fading");
            navFadeTimeoutId = 0;
          }, NAV_FADE_DELAY_MS);
        }, SIDE_BAR_REVEAL_DELAY_MS);
      }
    }
  };

  return {
    initialize() {
      applyMenuPose(menuIconElements, MENU_POSE_CLOSE[MENU_POSE_CLOSE.length - 1]);
      setMenuOpen(false, { animate: false });
    },
    prepareMedia,
    toggleMenu() {
      const isOpen = mobileMenuBtn?.getAttribute("aria-expanded") === "true";
      setMenuOpen(!isOpen);
    },
    closeMenu(options) {
      setMenuOpen(false, options);
    },
    onKeyDown(event) {
      if (mobileMenuBtn?.getAttribute("aria-expanded") !== "true") return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
      } else if (event.key === "Tab") {
        const controls = [
          ...nav.querySelectorAll(".main-nav__actions a, .main-nav__actions button"),
          ...mobileMenu.querySelectorAll("a[href]"),
        ];
        const current = controls.indexOf(document.activeElement);
        const next = (current + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
        event.preventDefault();
        controls[next]?.focus({ preventScroll: true });
      }
    },
    cleanup() {
      clearSideBarTimers();
      if (menuIconAnimationFrameId) {
        window.cancelAnimationFrame(menuIconAnimationFrameId);
      }
    },
  };
};
