export const getClientRuntimeElements = () => {
  const nav = document.getElementById("main-nav");
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");

  return {
    nav,
    mobileMenuBtn,
    mobileMenu: document.getElementById("mobile-menu"),
    closeMenuBtn: document.getElementById("close-menu"),
    mobileBreakpoint: window.matchMedia("(min-width: 1280px)"),
    heroSection: document.querySelector(".hero-imperio"),
    heroNav: document.querySelector(".hero-imperio__nav"),
    heroNavSurface: document.querySelector(".hero-imperio__nav .hero-nav__surface"),
    heroNavLinksWrap: document.querySelector(".hero-imperio__nav .hero-nav__links-wrap"),
    mainNavInner: nav?.querySelector(".main-nav__inner"),
    mainNavLinksWrap: nav?.querySelector(".main-nav__links-wrap"),
    customScrollbar: document.getElementById("imperio-scrollbar"),
    customScrollbarTrack: document.getElementById("imperio-scrollbar-track"),
    customScrollbarThumb: document.getElementById("imperio-scrollbar-thumb"),
    menuIconTopLine: mobileMenuBtn?.querySelector(".menu-icon__line--top"),
    menuIconMiddleLine: mobileMenuBtn?.querySelector(".menu-icon__line--middle"),
    menuIconBottomLine: mobileMenuBtn?.querySelector(".menu-icon__line--bottom"),
  };
};

export const toRectObject = (rect) => ({
  top: rect.top,
  right: rect.right,
  bottom: rect.bottom,
  left: rect.left,
  width: rect.width,
  height: rect.height,
});

export const getGlyphRect = (element) => {
  if (!element) return null;

  const range = document.createRange();
  range.selectNodeContents(element);

  const textRects = Array.from(range.getClientRects()).filter(
    (rect) => rect.width > 0 && rect.height > 0
  );

  if (textRects.length === 0) {
    const fallbackRect = element.getBoundingClientRect();
    return fallbackRect.width > 0 && fallbackRect.height > 0
      ? toRectObject(fallbackRect)
      : null;
  }

  const union = textRects.reduce(
    (acc, rect) => ({
      top: Math.min(acc.top, rect.top),
      right: Math.max(acc.right, rect.right),
      bottom: Math.max(acc.bottom, rect.bottom),
      left: Math.min(acc.left, rect.left),
    }),
    {
      top: Number.POSITIVE_INFINITY,
      right: Number.NEGATIVE_INFINITY,
      bottom: Number.NEGATIVE_INFINITY,
      left: Number.POSITIVE_INFINITY,
    }
  );

  return {
    top: union.top,
    right: union.right,
    bottom: union.bottom,
    left: union.left,
    width: union.right - union.left,
    height: union.bottom - union.top,
  };
};

export const getGlyphClusterRect = (root) => {
  if (!root) return null;

  const glyphs = Array.from(root.querySelectorAll(".nav-link"));
  if (glyphs.length === 0) {
    const fallbackRect = root.getBoundingClientRect();
    return fallbackRect.width > 0 && fallbackRect.height > 0
      ? toRectObject(fallbackRect)
      : null;
  }

  let clusterRect = null;
  glyphs.forEach((glyph) => {
    const rect = getGlyphRect(glyph);
    if (!rect) return;

    if (!clusterRect) {
      clusterRect = { ...rect };
      return;
    }

    clusterRect.top = Math.min(clusterRect.top, rect.top);
    clusterRect.right = Math.max(clusterRect.right, rect.right);
    clusterRect.bottom = Math.max(clusterRect.bottom, rect.bottom);
    clusterRect.left = Math.min(clusterRect.left, rect.left);
    clusterRect.width = clusterRect.right - clusterRect.left;
    clusterRect.height = clusterRect.bottom - clusterRect.top;
  });

  return clusterRect;
};
