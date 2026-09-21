export const createRevealController = () => {
  const revealElement = (element) => {
    element.classList.add("visible");
    element.classList.add("is-visible");
  };

  if (!("IntersectionObserver" in window)) {
    return {
      observeAll() {
        document.querySelectorAll(".fade-in-up, .section").forEach(revealElement);
      },
      disconnect() {},
    };
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        revealElement(entry.target);
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -100px 0px" }
  );

  return {
    observeAll() {
      document.querySelectorAll(".articles-section .fade-in-up").forEach((element, index) => {
        if (!element.style.transitionDelay) {
          element.style.transitionDelay = `${index * 100}ms`;
        }
      });

      document.querySelectorAll(".fade-in-up, .section").forEach((element) => {
        observer.observe(element);
      });
    },
    disconnect() {
      observer.disconnect();
    },
  };
};
