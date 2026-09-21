const TEXT_HOVER_CARD_SELECTOR = [
  ".services-foundation-card",
  ".service-cta-card",
  ".service-item",
].join(",");

export const createTextHoverController = () => {
  const cleanupEntries = [];

  const bindCard = (card) => {
    if (card.dataset.textHoverReady === "true") return;
    card.dataset.textHoverReady = "true";

    const activate = () => card.classList.add("is-text-hovered");
    const deactivate = () => card.classList.remove("is-text-hovered");

    card.addEventListener("pointerenter", activate);
    card.addEventListener("pointerleave", deactivate);
    card.addEventListener("focusin", activate);
    card.addEventListener("focusout", deactivate);

    cleanupEntries.push({ card, activate, deactivate });
  };

  return {
    initialize() {
      document.querySelectorAll(TEXT_HOVER_CARD_SELECTOR).forEach(bindCard);
    },
    cleanup() {
      cleanupEntries.forEach(({ card, activate, deactivate }) => {
        card.classList.remove("is-text-hovered");
        card.dataset.textHoverReady = "false";
        card.removeEventListener("pointerenter", activate);
        card.removeEventListener("pointerleave", deactivate);
        card.removeEventListener("focusin", activate);
        card.removeEventListener("focusout", deactivate);
      });
      cleanupEntries.length = 0;
    },
  };
};
