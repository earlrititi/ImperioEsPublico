// Choose one opaque surface for the whole interior-page navbar.
export const createNavSurfaceController = (nav) => {
  const controls = [...nav.querySelectorAll('.main-nav__links .main-nav__link, .main-nav__brand, .menu-button')];
  const surfaceAt = (x, y) => {
    for (const element of document.elementsFromPoint(x, y)) {
      if (nav.contains(element) || element.closest('#mobile-menu, .cookie-consent, #imperio-scrollbar, .global-home-mark')) continue;
      const explicit = element.getAttribute('data-home-mark-surface');
      if (explicit === 'black') return 'dark';
      if (explicit === 'red') return 'red';
      if (explicit === 'white') return 'light';
      const color = getComputedStyle(element).backgroundColor;
      const channels = color.match(/[\d.]+/g)?.map(Number);
      if (!color.startsWith('rgb') || !channels || (channels[3] ?? 1) < 0.5) continue;
      const [r, g, b] = channels;
      if (r > 130 && r > g * 1.6 && r > b * 1.6) return 'red';
      return (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255 > 0.5 ? 'light' : 'dark';
    }
    return 'light';
  };

  return {
    update() {
      if (nav.classList.contains('main-nav--menu-open')) return;
      const navRect = nav.getBoundingClientRect();
      const surfaces = [0.05, 0.25, 0.5, 0.75, 0.95].flatMap((fraction) =>
        [0.25, 0.75].map((row) =>
          surfaceAt(window.innerWidth * fraction, navRect.top + navRect.height * row)),
      );
      const surface = surfaces.filter((value) => value === 'dark').length > surfaces.length / 2 ? 'dark' : 'light';
      nav.dataset.navTheme = surface;
      for (const control of controls) {
        if (control.dataset.navSurface === surface) continue;
        control.dataset.navSurface = surface;
        control.style.setProperty('--nav-item-ink', surface === 'dark' ? '#fff' : '#111');
        control.style.setProperty('--nav-logo-filter', surface === 'dark' ? 'brightness(0) invert(1)' : 'none');
      }
    },
  };
};
