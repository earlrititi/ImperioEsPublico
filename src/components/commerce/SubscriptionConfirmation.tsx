import { useEffect, useRef, useState } from "preact/hooks";

export default function SubscriptionConfirmation() {
  const [state, setState] = useState("checking");
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState("Estamos comprobando tu acceso. No necesitas volver a pagar.");
  const heading = useRef<HTMLHeadingElement>(null);
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
