import { validateMail, type MailContent } from "./admin-mail-template";

export const AUTOMATION_KEYS = ["welcome", "checkout", "viewed_product", "site", "placed_order", "cart"] as const;
export type AutomationKey = typeof AUTOMATION_KEYS[number];
export type AutomationStep = { id: string; afterHours: number; mail: MailContent };
export type AutomationDraft = { key: AutomationKey; name: string; revision: number; steps: AutomationStep[] };
const mail = (subject: string, content: string, cta_label = "Volver a Imperio E", path = "/") => ({
  subject, preheader: "Historia, cultura y memoria compartida.", content, cta_label, cta_url: `https://imperioes.com${path}`,
});
const step = (id: string, afterHours: number, subject: string, content: string, cta?: string, path?: string): AutomationStep =>
  ({ id, afterHours, mail: mail(subject, content, cta, path) });
export const AUTOMATION_DEFAULTS: AutomationDraft[] = [
  { key: "welcome", name: "Bienvenida", revision: 0, steps: [
    step("day1", 24, "Gracias por estar aqui: tus 7 historias", "Hola {{nombre}},\n\nGracias por acercarte a Imperio Espa\u00f1ol. Estamos dando nuestros primeros pasos, con muchas horas detr\u00e1s y una idea clara: compartir la historia y la cultura hisp\u00e1nicas con rigor y pasi\u00f3n.\n\nPara darte la bienvenida, hemos preparado un cuaderno con 7 historias del Siglo de Oro. Puedes leerlo en la web o descargarlo en PDF. Ojal\u00e1 encuentres en sus p\u00e1ginas algo que despierte tu curiosidad.", "Leer las 7 historias", "/recursos/7-historias-del-siglo-de-oro"),
    step("day3", 72, "Una historia para leer con calma", "Hola {{nombre}},\n\nDetr\u00e1s de cada art\u00edculo hay lecturas, fuentes y preguntas. Nos gusta dedicarles tiempo para ir m\u00e1s all\u00e1 de un titular.\n\nHoy te invitamos a explorar el archivo y elegir una historia. Encontrar\u00e1s lecturas abiertas y otras para suscriptores, siempre indicadas antes de entrar. Gracias por compartir esta curiosidad con nosotros.", "Explorar el archivo", "/archivo"),
    step("day5", 120, "Las personas detras de Imperio Espa\u00f1ol", "Hola {{nombre}},\n\nImperio Espa\u00f1ol no nace solo para vender una camiseta. Queremos construir un espacio para conocer y divulgar un legado compartido a ambos lados del Atl\u00e1ntico.\n\nEsto acaba de empezar. Si te apetece conocernos un poco mejor, aqu\u00ed te contamos qui\u00e9nes somos y por qu\u00e9 nos hemos embarcado en este proyecto.", "Conocer al equipo", "/sobre-nosotros"),
    step("day8", 192, "Nuestra primera camiseta, al detalle", "Hola {{nombre}},\n\nNuestra primera camiseta representa tambi\u00e9n el comienzo de Imperio Espa\u00f1ol. Si est\u00e1s pensando en llevarla, queremos que tengas todos los detalles antes de decidir.\n\nCuesta 26,99 EUR, IVA incluido, m\u00e1s 3 EUR de env\u00edo por unidad, solo a la Pen\u00ednsula. Preparaci\u00f3n en un m\u00e1ximo de 48 horas y entrega en un m\u00e1ximo de 7 d\u00edas laborables tras el pago. En la ficha tienes las medidas, el tejido y las condiciones.\n\nSi dudas con la talla, responde a este correo. Estaremos al otro lado.", "Ver la Camiseta Imperial", "/tienda"),
    step("day12", 288, "Sigamos construyendo Imperio Espa\u00f1ol", "Hola {{nombre}},\n\nGracias por acompa\u00f1arnos en estos primeros pasos. Queremos seguir creando contenido y proyectos que acerquen la historia hisp\u00e1nica a m\u00e1s personas.\n\nSi quieres apoyar ese trabajo, Arcabucero y Maestre de Campo dan acceso a los art\u00edculos para suscriptores. Puedes comparar sus ventajas, precios y renovaci\u00f3n antes de elegir.\n\nY si prefieres seguir con las lecturas abiertas, nos alegrar\u00e1 igualmente tenerte cerca.", "Ver los planes", "/suscribirse"),
  ] },
  { key: "checkout", name: "Checkout abandonado", revision: 0, steps: [
    step("hour1", 1, "\u00bfTe ayudamos a terminar tu compra?", "Hola {{nombre}},\n\nHas iniciado la compra de la Camiseta Imperial, pero todav\u00eda no nos consta un pago completado. Puede que solo necesitaras un poco m\u00e1s de tiempo.\n\nAntes de intentarlo de nuevo, revisa el estado del pedido y comprueba si tu banco muestra alg\u00fan cargo. Si lo hay, no repitas el pago: responde a este correo y lo revisamos contigo.\n\nGracias por interesarte por esta primera pieza. Este mensaje no confirma un cobro ni reserva unidades.", "Volver a la tienda", "/tienda"),
    step("hour24", 24, "Estamos aqui si te has quedado a medias", "Hola {{nombre}},\n\nSabemos que a veces surgen dudas justo antes de comprar: la talla, la entrega o un paso del pago que no queda claro. Si te ha pasado, responde a este correo y te ayudamos.\n\nTu compra sigue sin figurar como pagada. Si tu banco muestra un cargo, no vuelvas a pagar hasta que lo comprobemos. Preferimos revisarlo contigo y hacer las cosas bien.", "Consultar la camiseta", "/tienda"),
    step("hour72", 72, "Lo dejamos aqui, sin compromiso", "Hola {{nombre}},\n\nEste es el \u00faltimo recordatorio de esta compra pendiente. No tienes que continuar ni responder si ahora no es el momento.\n\nSi decides volver, podr\u00e1s comprobar las tallas disponibles y el precio final en la tienda. No hemos reservado unidades con estos mensajes.\n\nGracias por haber pensado en Imperio Espa\u00f1ol.", "Ver disponibilidad", "/tienda"),
  ] },
  { key: "viewed_product", name: "Producto visitado", revision: 0, steps: [
    step("hour24", 24, "La historia detras de nuestra primera camiseta", "Hola {{nombre}},\n\nGracias por echar un vistazo a la Camiseta Imperial. Para nosotros es una de las primeras piezas de un proyecto que queremos seguir construyendo con cuidado.\n\nSi quieres conocerla mejor, en su ficha puedes ver el dise\u00f1o, las fotograf\u00edas, el tejido y las medidas de cada talla. Cuesta 26,99 EUR, IVA incluido, m\u00e1s 3 EUR de env\u00edo por unidad a la Pen\u00ednsula.\n\nSi te queda alguna pregunta, puedes responder directamente a este correo.", "Conocer la camiseta", "/tienda"),
  ] },
  { key: "site", name: "Visita sin continuar", revision: 0, steps: [
    step("hour48", 48, "Una invitacion a seguir explorando", "Hola {{nombre}},\n\nGracias por pasar por Imperio Espa\u00f1ol. Adem\u00e1s de nuestros dise\u00f1os, queremos compartir historias y fuentes que ayuden a conocer mejor la cultura hisp\u00e1nica.\n\nCuando te apetezca volver, el archivo es un buen lugar para empezar. Elige una lectura y t\u00f3mate tu tiempo: cada historia puede llevarte a otra.", "Explorar el archivo", "/archivo"),
  ] },
  { key: "placed_order", name: "Pedido pagado", revision: 0, steps: [] },
  { key: "cart", name: "Carrito abandonado", revision: 0, steps: [
    step("hour4", 4, "\u00bfTe quedo alguna duda con tu camiseta?", "Hola {{nombre}},\n\nHas a\u00f1adido la Camiseta Imperial al carrito. Si te has detenido por una duda con la talla o la entrega, responde a este correo y te ayudamos personalmente.\n\nPuedes volver al carrito para revisar tallas y cantidades. Si lo abres en otro dispositivo, quiz\u00e1 tengas que a\u00f1adirlas otra vez. Guardar productos no confirma una compra ni bloquea stock; la disponibilidad se comprueba al comprar.", "Revisar el carrito", "/carrito"),
    step("hour24", 24, "Gracias por tenernos en cuenta", "Hola {{nombre}},\n\nTe escribimos una \u00faltima vez por tu carrito. No hay compromiso de compra ni necesitas hacer nada si has cambiado de idea.\n\nSi todav\u00eda te interesa nuestra primera camiseta, puedes consultar las medidas y la disponibilidad en la tienda. Y si prefieres preguntarnos antes, estaremos encantados de ayudarte por aqu\u00ed.\n\nGracias por acercarte a estos primeros pasos de Imperio Espa\u00f1ol.", "Volver a la tienda", "/tienda"),
  ] },
];

export function validateAutomationDraft(key: unknown, input: unknown): AutomationStep[] {
  const definition = AUTOMATION_DEFAULTS.find(item => item.key === key);
  if (!definition || definition.key === "placed_order" || !Array.isArray(input) || input.length !== definition.steps.length) throw Error("INVALID_INPUT");
  return definition.steps.map((original, index) => {
    const candidate = input[index];
    if (!candidate || candidate.id !== original.id || candidate.afterHours !== original.afterHours ||
      !candidate.mail || typeof candidate.mail !== "object" || Array.isArray(candidate.mail)) throw Error("INVALID_INPUT");
    const content = validateMail(candidate.mail);
    for (const field of Object.values(content)) {
      if (/{{|}}/.test(field.replaceAll("{{nombre}}", ""))) throw Error("INVALID_INPUT");
    }
    if (/{{|}}/.test(content.cta_url)) throw Error("INVALID_INPUT");
    return { ...original, mail: content };
  });
}

export function personalizeAutomation(content: MailContent, name: string): MailContent {
  const safeName = name.replace(/[\r\n\u0000-\u001f\u007f]/g, " ").trim().slice(0, 100) || "lector";
  return validateMail(Object.fromEntries(Object.entries(content).map(([key, value]) => [key, value.replaceAll("{{nombre}}", safeName)])));
}

// Server-verified facts only. Browser events must never establish identity or a purchase.
export type AutomationFacts = {
  identified: boolean; verifiedEmail: boolean; marketingAcceptedAt: number | null;
  withdrawn: boolean; suppressed: boolean; analyticsConsent: boolean;
  paidAt: number | null; welcomeAt: number | null; visitedAt: number | null;
  productAt: number | null; cartAt: number | null; checkoutAt: number | null;
};
export type AutomationSent = { key: AutomationKey; step: string; anchor: number; sentAt: number };
export function planAutomation(facts: AutomationFacts, sent: AutomationSent[], now: number) {
  if (!Number.isFinite(now) || !facts.identified || !facts.verifiedEmail || facts.withdrawn || facts.suppressed ||
    facts.marketingAcceptedAt === null || !Number.isFinite(facts.marketingAcceptedAt) || facts.marketingAcceptedAt > now || facts.paidAt !== null) return [];
  const validTime = (time: number | null): time is number => time !== null && Number.isFinite(time) && time >= facts.marketingAcceptedAt! && time <= now;
  const recovery = validTime(facts.checkoutAt) ? "checkout" : validTime(facts.cartAt) ? "cart" : validTime(facts.productAt) ? "viewed_product" : "site";
  const anchors = { welcome: facts.welcomeAt, checkout: facts.checkoutAt, cart: facts.cartAt,
    viewed_product: facts.productAt, site: facts.visitedAt, placed_order: null };
  if (sent.some(item => Number.isFinite(item.sentAt) && item.sentAt > now - 6 * 3600000 && item.sentAt <= now)) return [];
  const due = AUTOMATION_DEFAULTS.flatMap(definition => {
    if (definition.key !== "welcome" && (definition.key !== recovery || !facts.analyticsConsent)) return [];
    const anchor = anchors[definition.key];
    if (!validTime(anchor) || now - anchor > 14 * 86400000) return [];
    return definition.steps.filter((item, index) => anchor + item.afterHours * 3600000 <= now &&
      !sent.some(log => log.key === definition.key && log.anchor === anchor &&
        definition.steps.findIndex(previous => previous.id === log.step) >= index))
      .map(item => ({ key: definition.key, step: item.id, anchor, dueAt: anchor + item.afterHours * 3600000 }));
  });
  // Never release a backlog as a burst; recovery takes precedence over welcome.
  return due.sort((a, b) => Number(a.key === "welcome") - Number(b.key === "welcome") || b.dueAt - a.dueAt).slice(0, 1);
}
