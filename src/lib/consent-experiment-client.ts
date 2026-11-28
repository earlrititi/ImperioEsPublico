import { EXPERIMENT_ENDPOINT, isExperimentDecision, type ExperimentDecision } from "./cookie-consent";

export function mountConsentExperiment(root: HTMLElement) {
  const banner = root.querySelector<HTMLElement>("[data-cookie-banner]");
  const settings = root.querySelector<HTMLDialogElement>("[data-cookie-settings]");
  const check = root.querySelector<HTMLInputElement>("[data-experiment-check]");
  const accept = root.querySelector<HTMLButtonElement>("[data-cookie-accept]");
  const reject = root.querySelector<HTMLButtonElement>("[data-cookie-reject]");
  const feedback = root.querySelector<HTMLElement>("[data-experiment-feedback]");
  const state = root.querySelector<HTMLElement>("[data-experiment-state]");
  const announcement = root.querySelector<HTMLElement>("[data-experiment-announcement]");
  if (!banner || !settings || !check || !accept || !reject || !feedback || !state || !announcement) return;

  let decision: ExperimentDecision | null = null;
  let saving = false;
  const setState = (value: unknown) => {
    decision = isExperimentDecision(value) ? value : null;
    state.textContent = decision === "accepted" ? "Has aceptado las preferencias de prueba."
      : decision === "rejected" ? "Has rechazado las preferencias de prueba." : "Aún no has elegido.";
  };

  const updateButtons = () => {
    accept.disabled = saving || !check.checked;
    reject.disabled = saving;
    check.disabled = saving;
  };

  const showBanner = () => {
    check.checked = false;
    feedback.textContent = "";
    updateButtons();
    banner.hidden = false;
  };

  const initialState = fetch(EXPERIMENT_ENDPOINT, { cache: "no-store" })
    .then(async response => setState(response.ok ? (await response.json()).decision : null))
    .catch(() => setState(null));

  const save = async (value: ExperimentDecision) => {
    if (saving || (value === "accepted" && !check.checked)) return;
    saving = true;
    updateButtons();
    feedback.textContent = "";
    try {
      const response = await fetch(EXPERIMENT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: value }),
      });
      if (!response.ok || (await response.json()).decision !== value) throw Error("Invalid receipt");
      setState(value);
      banner.hidden = true;
      announcement.textContent = state.textContent;
    } catch {
      feedback.textContent = "No se pudo guardar la elección. Vuelve a intentarlo.";
    } finally {
      saving = false;
      updateButtons();
    }
  };

  check.addEventListener("change", updateButtons);
  accept.addEventListener("click", () => void save("accepted"));
  reject.addEventListener("click", () => void save("rejected"));
  root.querySelector("[data-experiment-change]")?.addEventListener("click", () => {
    settings.close();
    showBanner();
    check.focus();
  });

  const openSettings = async () => {
    await initialState;
    if (!settings.open && !saving) settings.showModal();
  };
  root.querySelector("[data-cookie-configure]")?.addEventListener("click", () => void openSettings());
  document.querySelectorAll("[data-cookie-settings-trigger]").forEach(trigger => {
    trigger.addEventListener("click", event => {
      event.preventDefault();
      void openSettings();
    });
  });
  window.addEventListener("imperio:open-cookie-settings", () => void openSettings());

  void initialState.then(() => {
    if (decision) return;
    if (!document.getElementById("preloader") || document.body.classList.contains("preloader-done")) {
      showBanner();
    } else {
      window.addEventListener("preloader:done", () => { if (!decision) showBanner(); }, { once: true });
    }
  });
}
