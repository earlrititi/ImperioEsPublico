import { useEffect, useState } from "preact/hooks";
type Row = { id: string; email: string; plan: string; status: string; reason?: string };
type Result = { verified: Row[]; unresolved: Row[]; duplicateEmails: string[] };
const reasons: Record<string, string> = { missing_stripe_id: "Sin identificador de Stripe", not_in_current_stripe_account: "No pertenece a la cuenta actual de Stripe", customer_email_mismatch: "El correo no coincide con el cliente de Stripe", unknown_plan: "Plan sin identificar" };
export default function Subscriptions() {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null); setError("");
    fetch("/api/admin/subscriptions", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "No se pudo verificar Stripe."); return data;
    }).then(setResult).catch(e => { if (e.name !== "AbortError") setError(e.message); });
    return () => controller.abort();
  }, [attempt]);
  return <section><div class="admin-toolbar"><h1>Suscripciones</h1><button onClick={() => setAttempt(attempt + 1)}>Actualizar</button></div>
    {error && <p role="alert">{error}</p>}{!result && !error && <p role="status">Comprobando suscripciones en Stripe...</p>}
    {result && <><div class="admin-metrics"><div><span>Activas verificadas</span><strong>{result.verified.filter(s => s.status === "active").length}</strong></div><div><span>Requieren conciliacion</span><strong>{result.unresolved.length}</strong></div><div><span>Cuentas con duplicados</span><strong>{result.duplicateEmails.length}</strong></div></div>
      <label>Buscar correo <input type="search" value={query} onInput={e => setQuery(e.currentTarget.value)} /></label>
      {[{ title: "Verificadas en Stripe", rows: result.verified }, { title: "Pendientes de conciliacion", rows: result.unresolved }].map(group => <section key={group.title}><h2>{group.title}</h2><div class="admin-table-wrap"><table><thead><tr><th>Correo</th><th>Plan</th><th>Estado</th></tr></thead><tbody>
        {group.rows.filter(r => r.email?.toLowerCase().includes(query.toLowerCase())).map(row => <tr key={row.id}><td>{row.email}</td><td>{row.plan === "maestre_campo" ? "Maestre de Campo" : "Arcabucero"}</td><td class={row.reason ? "admin-status" : ""}>{row.reason ? reasons[row.reason] ?? row.reason : row.status}</td></tr>)}
        {!group.rows.length && <tr><td colSpan={3}>Sin registros.</td></tr>}
      </tbody></table></div></section>)}
    </>}
  </section>;
}
