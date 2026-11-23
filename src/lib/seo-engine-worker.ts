import { SITE } from "../config/site";
import { REVIEW_EMAIL } from "./seo-engine-model";
import { renderAdminMail } from "./admin-mail-template";

export function reviewMail(review: any, opportunity: any, published = false) {
  const link = `${SITE.url}/admin/seo?review=${review.id}`, v = review.verification;
  const content = [published ? "Articulo publicado despues de aprobacion administrativa." : "Nuevo articulo preparado para revision", `Titulo: ${review.snapshot.title}`, `Categoria: ${review.snapshot.category}`, `Keyword principal: ${opportunity.keyword}`, `Articulos relacionados: ${opportunity.relatedSlugs.length}`, `Fuentes con extracto comprobado: ${review.source_snapshot.length}`, `Advertencias: ${v.warnings.length}`, `Bloqueos: ${v.blockers.length}`, `Estado: ${published ? "Publicado" : "Pendiente de revision"}`, review.snapshot.lead,
    "Fuentes:", ...review.source_snapshot.map((s: any) => `${s.title}: ${s.url}`), "Control automatico orientativo, no validacion academica.", ...v.blockers, ...v.warnings, `Vista previa privada y revision: ${link}`, `Panel editorial: ${SITE.url}/admin/seo`].join("\n\n");
  return { from: `Imperio E <${SITE.contactEmail}>`, replyTo: SITE.contactEmail, to: REVIEW_EMAIL,
    subject: `[IMPERIO E] ${published ? "Articulo publicado" : "Nuevo articulo pendiente de aprobacion"} - ${review.snapshot.title}`.slice(0, 250),
    ...renderAdminMail({ subject: "Revision editorial", preheader: "Revision humana obligatoria", content, cta_label: published ? "Ver revision" : "Abrir revision privada", cta_url: link }) };
}
// Retained entry points make old maintenance routes harmless in manual mode.
export async function queueSeoNotice(actor: string, key: string, subject: string, content: string) {
  void [actor, key, subject, content];
  return { queued: false, mode: "manual" };
}
export async function reconcileSeoMail() { return { checked: 0 }; }
export async function runSeoWorker(kinds: string[] = []) {
  void kinds;
  return { jobs: [], delivery: { checked: 0 }, mode: "manual" };
}
