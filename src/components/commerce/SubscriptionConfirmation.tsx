import { useEffect, useRef, useState } from "preact/hooks";
import { LEGAL_DOCUMENT_VERSIONS } from "../../config/legal";
import { readSavedConsent } from "../../lib/cookie-consent";
import { trackConfirmedGooglePurchase } from "../../lib/google-analytics";

export default function SubscriptionConfirmation({ sessionId = "" }: { sessionId?: string }) {
  const [state, setState] = useState("checking");
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState("Estamos comprobando tu acceso. No necesitas volver a pagar.");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    // Keep the receipt capability only in this page's memory. A refresh of the
    // clean URL cannot turn an existing subscription into a fresh purchase.
    if (window.location.search || window.location.hash) window.history.replaceState(null, "", window.location.pathname);
    if (!/^cs_live_[A-Za-z0-9]{1,190}$/.test(sessionId)) return;
    let active = true, running = false;
    let receipt: unknown = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const measure = async () => {
      if (!active || running || !readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) return;
      if (receipt) { trackConfirmedGooglePurchase(receipt); return; }
      running = true;
      try {
        const response = await fetch("/api/subscriptions/purchase", { method: "POST", cache: "no-store", credentials: "same-origin",
          referrerPolicy: "no-referrer", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId }),
          signal: AbortSignal.timeout(10000) });
        if (!active) return;
        if (response.ok) {
          const result = await response.json();
          if (!active || !readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) return;
          receipt = result.analyticsPurchase ?? null;
          if (receipt) { trackConfirmedGooglePurchase(receipt); return; }
        }
      } catch { /* Analytics failure must never block access or suggest another payment. */ }
      finally {
        running = false;
        if (active && !receipt && Date.now() - started < 120000 && readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) {
          clearTimeout(timer);
          timer = setTimeout(() => { void measure(); }, 5000);
        }
      }
    };
    const consent = () => {
      if (!readSavedConsent(LEGAL_DOCUMENT_VERSIONS.cookies)?.analytics) { receipt = null; clearTimeout(timer); return; }
      void measure();
    };
    window.addEventListener("imperio:cookie-consent", consent);
    void measure();
    return () => { active = false; clearTimeout(timer); window.removeEventListener("imperio:cookie-consent", consent); };
  }, [sessionId]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    setState("checking");
    const refresh = async () => {
      try {
        const response = await fetch("/api/subscriptions/status", { cache: "no-store", signal: AbortSignal.timeout(10000) });
        const result = await response.json();
        if (!response.ok) throw new Error("No se pudo comprobar el acceso. No repitas el pago.");
        if (!active) return;
        if (result.state === "active") {
          setState("active"); setMessage("Tu acceso premium ya esta activo. Puedes empezar a leer y gestionar tu suscripcion desde tu cuenta.");
          return;
        }
        if (result.state === "sign_in") {
          setState("sign_in"); setMessage("Entra con el mismo correo utilizado al pagar para consultar tu suscripcion. Recibiras la confirmacion por correo cuando se procese el pago.");
          return;
        }
        setState("pending");
        setMessage("Estamos confirmando tu suscripcion. Te avisaremos por correo; no inicies otro pago.");
        if (Date.now() - started < 120000) timer = setTimeout(() => { void refresh(); }, 5000);
        else { setState("delayed"); setMessage("La confirmacion esta tardando mas de lo habitual. No repitas el pago. Puedes comprobar el estado o contactar con nosotros."); }
      } catch {
        if (active) { setState("error"); setMessage("No se pudo comprobar el acceso. No repitas el pago; comprueba tu cuenta o contacta con nosotros."); }
      }
    };
    void refresh();
    return () => { active = false; clearTimeout(timer); };
  }, [retry]);
  useEffect(() => { if (state === "active") heading.current?.focus(); }, [state]);
  return <section class="reservation-manager">
    <h2 ref={heading} tabIndex={-1}>{state === "active" ? "Acceso premium activado" : state === "sign_in" ? "Consulta tu suscripcion" : "Confirmacion de la suscripcion"}</h2>
    <p role="status" aria-live="polite" aria-atomic="true">{message}</p>
    <div class="commerce-payment-actions">
      <a class="btn btn-primary" href={state === "active" ? "/premium" : state === "sign_in" ? "/login?next=/cuenta" : "/cuenta"}>{state === "active" ? "Leer articulos premium" : state === "sign_in" ? "Iniciar sesion" : "Ir a mi cuenta"}</a>
      {["error", "delayed"].includes(state) && <button class="btn btn-ghost" type="button" onClick={() => setRetry(previous => previous + 1)}>Comprobar estado</button>}
      <a href="mailto:contacto@imperioes.com">Contactar con soporte</a>
    </div>
  </section>;
}
