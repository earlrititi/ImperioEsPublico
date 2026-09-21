import { z } from "astro/zod";

const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const url = z.url({ protocol: /^https?$/ });
export const editorialDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Use a real YYYY-MM-DD date");
const reference = z.object({
  id, title: text, author: text.optional(), publisher: text.optional(), year: text.optional(),
  isbn: text.optional(), doi: text.optional(), url: url.optional(), archive: text.optional(),
  shelfmark: text.optional(),
});

export const editorialBlocksSchema = z.object({
  contents: z.array(z.object({ title: text, sectionId: id })).default([]),
  summary: z.object({ question: text, answer: text, sectionId: id.optional() }).optional(),
  facts: z.array(z.object({ label: text, value: text, datetime: editorialDate.optional() })).default([]),
  context: text.optional(),
  interpretation: text.optional(),
  debate: text.optional(),
  primarySources: z.array(reference).default([]),
  bibliography: z.array(reference).default([]),
  notes: z.array(z.object({ id, text, sourceUrl: url.optional() })).default([]),
  faq: z.array(z.object({ question: text, answer: text })).default([]),
  timeline: z.array(z.object({ label: text, datetime: editorialDate.optional(), text, articleSlug: id.optional() })).default([]),
});

export const articleEditorialSchema = editorialBlocksSchema.extend({
  authorIds: z.array(id).default([]),
  entityIds: z.array(id).default([]),
  modifiedAt: editorialDate.optional(),
});

export const authorSchema = z.object({
  type: z.enum(["Person", "Organization"]).default("Person"),
  name: text, biography: text, specialization: text.optional(),
  sameAs: z.array(url).default([]), published: z.boolean().default(false),
});

export const referencePageSchema = editorialBlocksSchema.extend({
  title: text, description: text, introduction: text,
  kind: z.enum(["person", "event", "period", "territory", "battle", "institution", "work", "concept", "editorial"]),
  sections: z.array(z.object({ title: text, text })).min(1),
  entityIds: z.array(id).default([]), articleSlugs: z.array(id).default([]),
  modifiedAt: editorialDate.optional(), published: z.boolean().default(false),
});

export type EditorialBlocks = z.infer<typeof editorialBlocksSchema>;
export type ArticleEditorial = z.infer<typeof articleEditorialSchema>;
export type Author = z.infer<typeof authorSchema>;
export type ReferencePage = z.infer<typeof referencePageSchema>;

// PUBLIC editorial fields only. Never copy protected article bodies here.
export const ARTICLE_EDITORIAL = z.record(id, articleEditorialSchema).parse({});
export const AUTHORS = z.record(id, authorSchema).parse({
  "imperio-espanol": {
    type: "Organization",
    name: "Imperio Español",
    biography: "Imperio Español es el autor editorial de los artículos publicados en este proyecto.",
    published: true,
  },
});
export const REFERENCE_PAGES = z.record(id, referencePageSchema).parse({
  "politica-editorial": {
    title: "Política editorial",
    description: "Criterios de Imperio E para una divulgación histórica accesible, original, verificable y transparente, sin promesas de citas de inteligencia artificial.",
    introduction: "Imperio E quiere ser una fuente histórica accesible, fiable y útil para consultar y citar. Estos son los criterios que guían el desarrollo editorial del proyecto; no certifican que todos los artículos hayan completado ya esa revisión.",
    kind: "editorial",
    published: true,
    sections: [
      { title: "Contenido accesible", text: "Priorizamos el texto público disponible en el HTML, los enlaces descriptivos y las URLs estables. La lectura de las introducciones no debe depender de interacciones complejas." },
      { title: "Información original", text: "Nuestra prioridad editorial es desarrollar investigaciones, transcripciones de documentos y análisis propios que aporten contexto y valor. No generaremos páginas vacías ni afirmaciones históricas para aumentar el volumen de publicaciones." },
      { title: "Fuentes comprobables", text: "Los artículos deben identificar las fuentes utilizadas, facilitar bibliografía y enlaces a archivos cuando estén disponibles y distinguir hechos documentados, interpretación y debate historiográfico. No deben completarse citas, atribuciones o referencias desconocidas por suposición." },
      { title: "Autoría y transparencia", text: "Los artículos identifican a Imperio Español como autor editorial y muestran las fechas de publicación y de revisión cuando constan. No atribuimos credenciales ni revisiones que no se hayan verificado." },
      { title: "Correcciones", text: "Para comunicar un posible error, utiliza el apartado de contacto e indica la URL, el pasaje afectado y las fuentes que permiten contrastarlo. Cuando una revisión editorial modifique el contenido, deberá registrarse su fecha; un despliegue técnico no constituye una revisión histórica. No se establece un plazo de respuesta que el equipo no haya confirmado." },
      { title: "Claridad y contexto", text: "Las respuestas a preguntas concretas deben ser comprensibles por sí mismas y conservar el contexto histórico necesario. Los resúmenes y preguntas frecuentes son recursos editoriales opcionales, no relleno automático ni sustitutos de la investigación." },
      { title: "Contenido gratuito y de pago", text: "La propuesta combina artículos gratuitos de referencia y resúmenes públicos útiles de los artículos de pago. El cuerpo protegido solo se entrega tras comprobar la autorización en el servidor. No se concede acceso especial al texto premium a buscadores o asistentes de IA." },
      { title: "Medición sin promesas", text: "La evaluación debe distinguir indexación, visitas identificables y citas realmente observadas para consultas relevantes. Una visita de un asistente no demuestra una cita, y la ausencia de referente no demuestra ausencia de tráfico. No utilizamos una puntuación ficticia de GEO." },
      { title: "No se pueden garantizar las citas de una IA", text: "Podemos mejorar la accesibilidad y utilidad de las fuentes, pero no controlar qué selecciona un buscador o asistente. Google indica que cumplir sus requisitos no garantiza el rastreo, la indexación ni la aparición. No prometemos citas ni utilizamos supuestos trucos GEO." },
    ],
    bibliography: [{ id: "google-ai-features", title: "AI features and your website", author: "Google Search Central", url: "https://developers.google.com/search/docs/appearance/ai-features" }],
  },
});

export function getArticleEditorial(slug: string): ArticleEditorial {
  const editorial = ARTICLE_EDITORIAL[slug] ?? articleEditorialSchema.parse({});
  return editorial.authorIds.length
    ? editorial
    : { ...editorial, authorIds: ["imperio-espanol"] };
}

export function getAuthors(ids: string[]) {
  return ids.flatMap(id => AUTHORS[id]?.published ? [{ id, ...AUTHORS[id] }] : []);
}

export function getEntities(ids: string[]) {
  return ids.flatMap(id => REFERENCE_PAGES[id]?.published ? [{ id, ...REFERENCE_PAGES[id] }] : []);
}
