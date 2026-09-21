export const createNavController = ({ nav, heroSection }) => {
  const update = () => {
    if (!nav) return;
    const progress = Math.min(1, Math.max(0, window.scrollY / 220));
    nav.style.setProperty("--nav-progress", String(progress));
    nav.classList.add("main-nav--merged", "main-nav--hamburger-dark");
    heroSection?.classList.remove("hero-imperio--nav-captured");
  };
  return { start: update, stop() {}, syncLayout: update, update };
};
