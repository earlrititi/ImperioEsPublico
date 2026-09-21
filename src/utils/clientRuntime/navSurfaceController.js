// Read the surface under each control so mixed backgrounds remain legible.
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
      for (const control of controls) {
        const rect = control.getBoundingClientRect();
        const x = Math.max(1, Math.min(window.innerWidth - 1, rect.left + rect.width / 2));
        const y = rect.top + rect.height / 2;
        if (!rect.width || rect.right <= 0 || rect.left >= window.innerWidth) continue;
        const surface = surfaceAt(x, y);
        if (control.dataset.navSurface === surface) continue;
        control.dataset.navSurface = surface;
        control.style.setProperty('--nav-item-ink', surface === 'dark' ? '#fff' : '#111');
        control.style.setProperty('--nav-logo-filter', surface === 'dark' ? 'brightness(0) invert(1)' : 'none');
      }
    },
  };
};
