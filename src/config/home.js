import { withBase } from "../utils/basePath";

export const PLAN_COMPARISON_INTRO =
  "Elige cómo formar parte de Imperio Español. El plan Piquero es gratuito y te permite empezar a explorar la comunidad y descubrir nuestras publicaciones principales. El plan Arcabucero está pensado para quienes quieren apoyar el proyecto y recibir contenido adicional. El plan Maestre de Campo ofrece la experiencia más completa, con acceso prioritario y contenidos pensados para los miembros más comprometidos con el proyecto. Únete a la comunidad, apoya la divulgación histórica y acompáñanos en la construcción de un espacio dedicado al legado, la cultura y la memoria del Imperio Español.";

export const PLAN_COMPARISON_LABELS = [
  "Mensual",
  "Anual",
  "Función",
  "Foro",
  "Discord",
  "Artículos",
  "Archivo",
  "Boletín personalizado",
  "Lanzamientos anticipados",
  "Descuento lanzamientos",
  "Bonus anual",
];

export const SERVICES_ITEMS = [
  {
    id: "01",
    statLabel: "Nivel 1",
    title: "Piquero",
    actionHref: withBase("/registro"),
    imageSrc: withBase("/images/services/consultoria.jpg"),
    imageAlt: "Piquero",
    description:
      "Una vision audaz como la tuya tiene el poder de hacer avanzar y alinear comunidades. El Piquero era la base de los Tercios: el soldado raso del ejército, pero a su vez esencial, ya que sostenía las líneas de los flancos. Este es el punto de entrada para explorar el proyecto de manera gratuita.",
    highlights: [
      "GRATIS",
      "-",
      "Explorar",
      "Acceso como lector al foro",
      "-",
      "Lectura de nuevos artículos limitada",
      "Lectura de artículos del archivo limitada",
      "-",
      "-",
      "-",
      "-",
    ],
  },
  {
    id: "02",
    statLabel: "Nivel 2",
    title: "Arcabucero",
    subscriptionHref: withBase("/suscribirse#arcabucero"),
    subscriptionLabel: "Consultar estado",
    priceBadge: "1,99 €/mes",
    imageSrc: withBase("/images/services/planificacion.jpg"),
    imageAlt: "Planificacion",
    description:
      "Los arcabuces y mosquetes hicieron de los tercios una unidad militar de infantería de élite El Arcabucero representaba la potencia de fuego y la precisión. Un escalón superior en el ejército que marcaba diferencia en el campo de batalla. Esta suscripción permite apoyar el proyecto y disfrutar de mayores ventajas. Incluye:",
    highlights: [
      "1,99 €",
      "17,99 €",
      "Acceder",
      "Próximamente: comentar en el foro de debate",
      "Próximamente: acceso básico al Discord",
      "Todos los artículos para suscriptores",
      "Lectura ilimitada de todo el archivo",
      "Próximamente: boletín semanal",
      "Próximamente: acceso anticipado a lanzamientos",
      "Próximamente: descuento en la tienda",
      "Próximamente: obsequio anual",
    ],
    reverseOnDesktop: true,
  },
  {
    id: "03",
    statLabel: "Nivel 3",
    title: "Maestre de Campo",
    subscriptionHref: withBase("/suscribirse#maestre-de-campo"),
    subscriptionLabel: "Consultar estado",
    priceBadge: "3,99 €/mes",
    imageSrc: withBase("/images/services/arquitectura.jpg"),
    imageAlt: "Maestre de Campo",
    description:
      "El Maestre de Campo era uno de los oficiales de mayor rango. Al mando de un Tercio ejercía autoridad, y tenía un rol operativo, tomaba decisiones y lideraba a sus tropas. Esta es la suscripción para quienes desean involucrarse más profundamente y recibir el mayor número de beneficios. Incluye:",
    highlights: [
      "3,99 €",
      "37,99 €",
      "Participar",
      "Próximamente: propuestas en foro y Discord",
      "Próximamente: acceso completo al Discord",
      "Todos los artículos para suscriptores",
      "Lectura ilimitada de todo el archivo",
      "Próximamente: Gaceta Imperial digital",
      "Próximamente: acceso anticipado a lanzamientos",
      "Próximamente: descuento en la tienda",
      "Próximamente: obsequio anual",
    ],
  },
];

const responsiveArticleImage = (fileBase, widths, imageWidth, imageHeight) => {
  const largestWidth = widths[widths.length - 1];
  const buildSrcSet = (format) =>
    widths
      .map(
        (width) =>
          `${withBase(`/images/articulos/${encodeURIComponent(fileBase)}-${width}.${format}`)} ${width}w`
      )
      .join(", ");

  return {
    imageSrc: withBase(`/images/articulos/${encodeURIComponent(fileBase)}-${largestWidth}.webp`),
    imageAvifSrcSet: buildSrcSet("avif"),
    imageWebpSrcSet: buildSrcSet("webp"),
    imageWidth,
    imageHeight,
  };
};

export const ARTICLES_ITEMS = [
  {
    slug: "bienvenidos-a-la-web-del-imperio-espanol",
    category: "La Corona y el Gobierno del Imperio",
    title: "Bienvenidos a la web del Imperio Español",
    seoTitle: "Bienvenidos a Imperio Español | Historia y divulgación",
    description:
      "Presentación de Imperio Español, un espacio de divulgación dedicado a la historia, la memoria y el legado de la Monarquía Hispánica.",
    lead:
      "Una presentación del proyecto editorial Imperio Español y de su propósito: divulgar la historia de la Monarquía Hispánica con contexto, fuentes y una mirada crítica.",
    publishedAt: "2026-09-03",
    sourceFile: "Bienvenidos a la web del Imperio Español.txt",
    href: withBase("/papeles-y-tratados/bienvenidos-a-la-web-del-imperio-espanol"),
    imageSrc: withBase("/images/logo-redv2-480.webp"),
    imageAlt: "Emblema de Imperio Español",
    imageWidth: 480,
    imageHeight: 371,
    wordmarkSrc: withBase("/images/imperio-espanol-wordmark.svg"),
    imageCaption: "Emblema y marca editorial de Imperio Español.",
    imageCredit: "Imperio Español",
    imageSource: "Archivo del proyecto",
    imageLicense: "Uso propio",
    relatedSlugs: [
      "una-monarquia-de-reinos-espana-siglos-xvi-xvii",
      "leyenda-negra-espanola-hablan-los-historiadores",
    ],
  },
  {
    slug: "el-imperio-donde-nunca-se-pone-el-sol",
    category: "La Corona y el Gobierno del Imperio",
    title: "El Imperio donde nunca se pone el sol",
    seoTitle: "El imperio donde nunca se ponía el sol | Imperio Español",
    description:
      "Historia de la Monarquía Hispánica y del origen del título del Imperio donde nunca se ponía el sol.",
    lead:
      "El origen, alcance y límites de una fórmula que describió la dispersión planetaria de los dominios de la Monarquía Hispánica.",
    publishedAt: "2026-09-03",
    sourceFile: "Imperio donde nunca se ponia el sol.txt",
    href: withBase("/papeles-y-tratados/el-imperio-donde-nunca-se-pone-el-sol"),
    ...responsiveArticleImage(
      "PRINCIPAL - El imperio donde nunca se pone el sol",
      [640, 1024, 1408],
      1408,
      768
    ),
    imageAlt: "Mapa del Imperio Español representado entre el día y la noche",
    imageCaption: "Representación del alcance global de la Monarquía Hispánica.",
    imageCredit: "Imperio Español",
    imageSource: "Archivo del proyecto",
    imageLicense: "Recreación digital de uso propio",
    relatedSlugs: [
      "una-monarquia-de-reinos-espana-siglos-xvi-xvii",
      "imperio-espanol-e-imperio-britanico",
      "comercio-entre-espana-y-las-indias",
    ],
  },
  {
    slug: "12-de-octubre-dia-de-la-hispanidad",
    category: "Expediciones, Rutas y Descubrimientos",
    title: '12 de octubre: Del "encuentro entre dos mundos" al Día de la Hispanidad',
    seoTitle: "12 de octubre y Día de la Hispanidad | Imperio Español",
    description:
      "Origen y evolución del 12 de octubre, desde el encuentro de 1492 hasta sus distintas conmemoraciones en España y América.",
    lead:
      "Del viaje de 1492 a la Fiesta Nacional de España: historia de una fecha compartida, discutida y resignificada a ambos lados del Atlántico.",
    publishedAt: "2026-09-03",
    sourceFile: "12 de Octubre.txt",
    href: withBase("/papeles-y-tratados/12-de-octubre-dia-de-la-hispanidad"),
    ...responsiveArticleImage(
      "PRINCIPAL - 12 de octubre. Del encuentro de dos mundos al Día de la Hispanidad",
      [640, 1024, 1408],
      1408,
      768
    ),
    imageAlt: "Alegoría histórica de la Hispanidad y del encuentro entre dos mundos",
    imageCaption: "Alegoría contemporánea del encuentro entre dos mundos.",
    imageCredit: "Imperio Español",
    imageSource: "Archivo del proyecto",
    imageLicense: "Imagen generada por IA; uso propio",
    relatedSlugs: [
      "tratado-de-tordesillas-division-del-mundo",
      "vasallos-monarquia-derechos-deberes-indias",
      "comercio-entre-espana-y-las-indias",
    ],
  },
  {
    slug: "rey-de-espana-legitimo-emperador-de-roma",
    category: "La Corona y el Gobierno del Imperio",
    title: "¿Sabías que el Rey de España es el legítimo Emperador de Roma?",
    seoTitle: "El Rey de España y el título de Emperador de Roma | Historia",
    description:
      "La transmisión histórica de los derechos de la Corona bizantina y su relación con los Reyes Católicos y la Monarquía Hispánica.",
    lead:
      "Una revisión de las reclamaciones dinásticas sobre la herencia bizantina y de los límites históricos del supuesto título romano de los reyes de España.",
    publishedAt: "2026-09-04",
    sourceFile: "Emperador Roma.txt",
    href: withBase("/papeles-y-tratados/rey-de-espana-legitimo-emperador-de-roma"),
    ...responsiveArticleImage("emperador-de-roma", [640, 1024], 1024, 691),
    imageAlt: "Mapa ilustrado del Imperio romano en el año 117",
    imageCaption: "Representación cartográfica del Imperio romano.",
    imageSource: "Archivo del proyecto",
    imageLicense: "Procedencia original pendiente de documentar",
    relatedSlugs: [
      "roma-y-la-monarquia-hispanica",
      "una-monarquia-de-reinos-espana-siglos-xvi-xvii",
    ],
  },
  {
    slug: "leyenda-negra-espanola-hablan-los-historiadores",
    category: "La Corona y el Gobierno del Imperio",
    title: "La Leyenda Negra Española: Hablan los historiadores",
    seoTitle: "La Leyenda Negra según los historiadores | Imperio Español",
    description:
      "Origen y evolución de la Leyenda Negra: propaganda, conflictos europeos, conquista americana e interpretaciones historiográficas.",
    lead:
      "Cómo hechos reales, crítica interna y propaganda rival construyeron una imagen excepcionalmente negativa de la Monarquía Hispánica.",
    publishedAt: "2026-09-06",
    sourceFile: "Leyenda Negra.txt",
    href: withBase("/papeles-y-tratados/leyenda-negra-espanola-hablan-los-historiadores"),
    ...responsiveArticleImage(
      "leyenda-negra-hablan-los-historiadores",
      [640, 1024],
      1024,
      783
    ),
    imageAlt: "Grabado de Theodor de Bry sobre la violencia de la conquista española en América",
    imageCaption:
      "Ilustración de Theodor de Bry para una edición de la denuncia de Bartolomé de las Casas, 1598.",
    imageCredit: "Theodor de Bry",
    imageSource: "Bibliothèque nationale de France / Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Illustrations_de_Narratio_regionum_Indicarum_per_Hispanos_quosdam_devastattarum_%E2%80%94_Jean_Th%C3%A9odore_de_Bry_%E2%80%94_14.jpg",
    imageLicense: "Dominio público",
    relatedSlugs: [
      "imperio-espanol-e-imperio-britanico",
      "vasallos-monarquia-derechos-deberes-indias",
      "carlos-v-y-la-justicia-de-la-conquista",
    ],
  },
  {
    slug: "carlos-v-y-la-justicia-de-la-conquista",
    category: "La Forja de las Indias",
    title: "Carlos V y la justicia de la conquista: cuando España se interrogó a sí misma",
    seoTitle: "Carlos V y la justicia de la conquista | Imperio Español",
    description:
      "La Controversia de Valladolid y el debate jurídico impulsado durante el reinado de Carlos V sobre la legitimidad de la conquista.",
    lead:
      "La Controversia de Valladolid y el debate jurídico y teológico sobre conquista, soberanía y trato a las poblaciones indígenas.",
    publishedAt: "2026-09-04",
    sourceFile: "Carlos V justicia.txt",
    href: withBase("/papeles-y-tratados/carlos-v-y-la-justicia-de-la-conquista"),
    ...responsiveArticleImage(
      "carlos-v-justicia-de-la-conquista",
      [640, 1024],
      1024,
      691
    ),
    imageAlt: "Recreación de la Controversia de Valladolid de 1550",
    imageCaption: "Recreación contemporánea de la Controversia de Valladolid.",
    imageCredit: "Imperio Español",
    imageSource: "Archivo del proyecto",
    imageLicense: "Recreación digital de uso propio",
    relatedSlugs: [
      "vasallos-monarquia-derechos-deberes-indias",
      "lenguas-indias-monarquia-hispanica",
      "leyenda-negra-espanola-hablan-los-historiadores",
    ],
  },
  {
    slug: "tras-lepanto-constantinopla",
    category: "Espada, Mar y Frontera",
    title: "Tras Lepanto, ¿Constantinopla?",
    seoTitle: "Tras Lepanto, ¿Constantinopla? | Historia del Imperio Español",
    description:
      "Las consecuencias de la batalla de Lepanto y los proyectos de la Monarquía Hispánica relacionados con Constantinopla.",
    lead:
      "Qué cambió realmente después de Lepanto y hasta dónde llegaron los proyectos hispánicos relacionados con Constantinopla.",
    publishedAt: "2026-09-04",
    sourceFile: "Tras Lepanto.txt",
    href: withBase("/papeles-y-tratados/tras-lepanto-constantinopla"),
    ...responsiveArticleImage("tras-lepanto-constantinopla", [640, 1024], 1024, 555),
    imageAlt: "Recreación histórica de Constantinopla y la basílica de Santa Sofía",
    imageCaption: "Recreación contemporánea de Constantinopla y Santa Sofía.",
    imageCredit: "Imperio Español",
    imageSource: "Archivo del proyecto",
    imageLicense: "Recreación digital de uso propio",
    relatedSlugs: [
      "el-espanol-inquebrantable-reputacion-militar",
      "cruz-de-borgona-historia",
    ],
  },
  {
    slug: "las-cuentas-del-gran-capitan",
    category: "Espada, Mar y Frontera",
    title: "Las cuentas del Gran Capitán",
    seoTitle: "Las cuentas del Gran Capitán | Historia de España e Italia",
    description:
      "Origen y significado histórico de las célebres cuentas atribuidas a Gonzalo Fernández de Córdoba, el Gran Capitán.",
    lead:
      "Historia, memoria y crítica documental de la célebre respuesta atribuida a Gonzalo Fernández de Córdoba.",
    publishedAt: "2026-09-05",
    sourceFile: "Las cuentas del gran capitan.txt",
    href: withBase("/papeles-y-tratados/las-cuentas-del-gran-capitan"),
    ...responsiveArticleImage("cuentas-del-gran-capitan", [640, 1024], 1024, 1097),
    imageAlt:
      "El Gran Capitán representado por José Casado del Alisal en el cuadro Los dos caudillos",
    imageCaption:
      "Detalle de Los dos caudillos o El Gran Capitán contemplando el cadáver del duque de Nemours, 1866.",
    imageCredit: "José Casado del Alisal",
    imageSource: "Senado de España",
    imageLicense: "Dominio público",
    relatedSlugs: [
      "el-espanol-inquebrantable-reputacion-militar",
      "rocroi-1643-mito-fin-tercios",
    ],
  },
  {
    slug: "cruz-de-borgona-historia",
    category: "Espada, Mar y Frontera",
    title: "La Cruz de Borgoña: historia de una enseña de la Monarquía Hispánica",
    seoTitle: "Cruz de Borgoña: historia y uso en la Monarquía Hispánica",
    description:
      "Origen, evolución y usos militares de la Cruz de Borgoña desde Felipe el Hermoso hasta su permanencia en la tradición española.",
    lead:
      "De divisa dinástica borgoñona a emblema común de Tercios, armadas y fortalezas de una monarquía extendida por varios continentes.",
    publishedAt: "2026-09-06",
    sourceFile: "Cruz de Borgona.txt",
    href: withBase("/papeles-y-tratados/cruz-de-borgona-historia"),
    ...responsiveArticleImage("cruz-de-borgona", [640, 1024], 1024, 683),
    imageAlt: "Cruz de Borgoña roja formada por ramas nudosas sobre fondo blanco",
    imageCaption: "Representación contemporánea de la Cruz de Borgoña.",
    imageCredit: "Ningyou y colaboradores de Wikimedia Commons",
    imageSource: "Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Flag_of_Cross_of_Burgundy.svg",
    imageLicense: "Dominio público; versión también disponible bajo CC BY-SA 3.0",
    relatedSlugs: [
      "el-espanol-inquebrantable-reputacion-militar",
      "rocroi-1643-mito-fin-tercios",
      "tras-lepanto-constantinopla",
    ],
  },
  {
    slug: "vasallos-monarquia-derechos-deberes-indias",
    category: "La Forja de las Indias",
    title: "Vasallos de la Monarquía: derechos y deberes en las Indias",
    seoTitle: "Vasallos, derechos y deberes en las Indias españolas",
    description:
      "Estatus jurídico, derechos, tributos y obligaciones de los habitantes de las Indias según el derecho de la Monarquía Hispánica.",
    lead:
      "Por qué vasallos, naturales y vecinos son categorías más precisas que ciudadanos para comprender el derecho indiano.",
    publishedAt: "2026-09-06",
    sourceFile: "Vasallos de la Monarquia.txt",
    href: withBase("/papeles-y-tratados/vasallos-monarquia-derechos-deberes-indias"),
    ...responsiveArticleImage("derechos-habitantes-indias", [640, 1024], 1024, 1215),
    imageAlt: "Retrato ecuestre del emperador Carlos V pintado por Tiziano",
    imageCaption: "Carlos V en Mühlberg, 1548.",
    imageCredit: "Tiziano",
    imageSource: "Museo Nacional del Prado / Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Carlos_V_en_M%C3%BChlberg,_by_Titian,_from_Prado_in_Google_Earth.jpg",
    imageLicense: "Obra y reproducción en dominio público",
    relatedSlugs: [
      "carlos-v-y-la-justicia-de-la-conquista",
      "lenguas-indias-monarquia-hispanica",
      "libertadores-americanos-y-espana",
    ],
  },
  {
    slug: "lenguas-indias-monarquia-hispanica",
    category: "La Forja de las Indias",
    title: "Lenguas de las Indias: gramáticas y vocabularios indígenas",
    seoTitle: "Lenguas indígenas, gramáticas y vocabularios de las Indias",
    description:
      "Cómo hablantes indígenas, misioneros e impresores estudiaron y documentaron náhuatl, quechua, aimara, guaraní y otras lenguas.",
    lead:
      "Gramáticas, vocabularios e imprentas conservaron un patrimonio lingüístico excepcional dentro de un proceso colonial desigual.",
    publishedAt: "2026-09-06",
    sourceFile: "Lenguas de las Indias.txt",
    href: withBase("/papeles-y-tratados/lenguas-indias-monarquia-hispanica"),
    ...responsiveArticleImage("lenguas-indigenas-monarquia", [640, 1024], 1024, 1529),
    imageAlt: "Portada de un Arte de la lengua mexicana impreso en época virreinal",
    imageCaption: "Portada de Arte de la lengua mexicana.",
    imageSource: "Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Arte_de_la_lengua_mexicana.jpg",
    imageLicense: "Dominio público",
    relatedSlugs: [
      "vasallos-monarquia-derechos-deberes-indias",
      "carlos-v-y-la-justicia-de-la-conquista",
      "comercio-entre-espana-y-las-indias",
    ],
  },
  {
    slug: "el-espanol-inquebrantable-reputacion-militar",
    category: "Espada, Mar y Frontera",
    title: "El español inquebrantable: origen de una reputación militar",
    seoTitle: "El español inquebrantable y la reputación de los Tercios",
    description:
      "Origen histórico de la reputación militar de la infantería española: disciplina, campañas, propaganda, derrotas y memoria.",
    lead:
      "La fama de los soldados de los Tercios nació de experiencia y disciplina, pero también de propaganda, teatro y memoria nacional.",
    publishedAt: "2026-09-06",
    sourceFile: "El espanol inquebrantable.txt",
    href: withBase("/papeles-y-tratados/el-espanol-inquebrantable-reputacion-militar"),
    ...responsiveArticleImage("espanol-inquebrantable", [640, 1024], 1024, 692),
    imageAlt: "Soldados de un Tercio español descansando en un campamento del siglo XVII",
    imageCaption: "Soldados de un Tercio español en su vivac, siglo XVII.",
    imageCredit: "Cornelis de Wael",
    imageSource: "Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Cornelis_de_Wael_-_Spanish_Tercio_soldiers_at_their_bivouac.jpg",
    imageLicense: "Dominio público",
    relatedSlugs: [
      "rocroi-1643-mito-fin-tercios",
      "cruz-de-borgona-historia",
      "las-cuentas-del-gran-capitan",
    ],
  },
  {
    slug: "rocroi-1643-mito-fin-tercios",
    category: "Espada, Mar y Frontera",
    title: "Rocroi, 1643: la batalla detrás del mito del fin de los Tercios",
    seoTitle: "Rocroi 1643: el mito del fin de los Tercios españoles",
    description:
      "Qué ocurrió en la batalla de Rocroi, por qué venció Francia y por qué aquella derrota no terminó con los Tercios españoles.",
    lead:
      "Una derrota grave convertida después en final simbólico de una época que, en realidad, continuó durante décadas.",
    publishedAt: "2026-09-06",
    sourceFile: "Rocroi 1643.txt",
    href: withBase("/papeles-y-tratados/rocroi-1643-mito-fin-tercios"),
    ...responsiveArticleImage("rocroi-1643", [640, 1024], 1024, 865),
    imageAlt: "Representación histórica de la batalla de Rocroi de 1643",
    imageCaption: "La batalla de Rocroi, pintura de François-Joseph Heim, siglo XIX.",
    imageCredit: "François-Joseph Heim",
    imageSource: "Wikimedia Commons",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:HeimBattleRocroy.jpg",
    imageLicense: "Dominio público",
    relatedSlugs: [
      "el-espanol-inquebrantable-reputacion-militar",
      "cruz-de-borgona-historia",
      "cartagena-de-indias-1741-blas-de-lezo",
    ],
  },
  {
    slug: "tratado-de-tordesillas-division-del-mundo",
    category: "La Corona y el Gobierno del Imperio",
    title: "Tratado de Tordesillas: la división del mundo entre Castilla y Portugal",
    seoTitle: "Tratado de Tordesillas: Castilla, Portugal y el Atlántico",
    description:
      "Historia del Tratado de Tordesillas de 1494, su meridiano, la negociación entre Castilla y Portugal y sus consecuencias globales.",
    lead:
      "Un acuerdo diplomático para separar áreas de expansión oceánica cuya línea era mucho más difícil de medir que de dibujar.",
    publishedAt: "2026-09-06",
    sourceFile: "Tratado de Tordesillas.txt",
    href: withBase("/papeles-y-tratados/tratado-de-tordesillas-division-del-mundo"),
    ...responsiveArticleImage("tratado-tordesillas", [640, 1024], 1024, 1364),
    imageAlt: "Primera página del Tratado de Tordesillas conservado en el Archivo General de Indias",
    imageCaption: "Tratado de Tordesillas, 7 de junio de 1494.",
    imageSource: "Archivo General de Indias / Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Tratado_de_Tordesillas_(Archivo_General_de_Indias).jpg",
    imageLicense: "Documento en dominio público",
    relatedSlugs: [
      "magallanes-elcano-primera-vuelta-al-mundo",
      "comercio-entre-espana-y-las-indias",
      "12-de-octubre-dia-de-la-hispanidad",
    ],
  },
  {
    slug: "garcia-lopez-de-cardenas-gran-canon-1540",
    category: "Expediciones, Rutas y Descubrimientos",
    title: "García López de Cárdenas y la llegada europea al Gran Cañón en 1540",
    seoTitle: "García López de Cárdenas y el Gran Cañón en 1540 | Historia",
    description:
      "La expedición de García López de Cárdenas, primer grupo europeo documentado ante el Gran Cañón, guiado por poblaciones hopi.",
    lead:
      "El primer avistamiento europeo documentado fue una llegada guiada a un paisaje conocido y habitado desde hacía milenios.",
    publishedAt: "2026-09-06",
    sourceFile: "Garcia Lopez de Cardenas.txt",
    href: withBase("/papeles-y-tratados/garcia-lopez-de-cardenas-gran-canon-1540"),
    ...responsiveArticleImage("garcia-lopez-cardenas-gran-canon", [640, 1024], 1024, 715),
    imageAlt: "Vista histórica del Gran Cañón desde Moran Point en la orilla sur",
    imageCaption: "Vista del Gran Cañón desde Moran Point, fotografía de 1945.",
    imageCredit: "George A. Grant, Grand Canyon National Park",
    imageSource: "National Park Service / Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:0263_Grand_Canyon_Scenic_View_from_Moran_Point_(5039996413).jpg",
    imageLicense: "CC BY 2.0",
    relatedSlugs: [
      "12-de-octubre-dia-de-la-hispanidad",
      "vasallos-monarquia-derechos-deberes-indias",
    ],
  },
  {
    slug: "cagayan-1582-espanoles-japoneses-piratas",
    category: "Espada, Mar y Frontera",
    title: "Cagayán, 1582: españoles, japoneses y piratas en Filipinas",
    seoTitle: "Cagayán 1582: españoles, japoneses y piratas en Filipinas",
    description:
      "Los combates de Cagayán de 1582, sus fuentes y el mito moderno de sesenta españoles enfrentados a mil samuráis.",
    lead:
      "Un episodio real de la frontera asiática de la Monarquía convertido en leyenda mediante cifras y etiquetas difíciles de sostener.",
    publishedAt: "2026-09-06",
    sourceFile: "Cagayan 1582.txt",
    href: withBase("/papeles-y-tratados/cagayan-1582-espanoles-japoneses-piratas"),
    ...responsiveArticleImage("cagayan-1582", [640, 1024], 1024, 718),
    imageAlt: "Mapa histórico del río Cagayán y el norte de Luzón",
    imageCaption: "Mapa del río Cagayán, ca. 1720.",
    imageSource: "Wikimedia Commons",
    imageSourceUrl: "https://commons.wikimedia.org/wiki/File:Cagayan_River_1720.png",
    imageLicense: "Dominio público",
    relatedSlugs: [
      "magallanes-elcano-primera-vuelta-al-mundo",
      "comercio-entre-espana-y-las-indias",
      "el-espanol-inquebrantable-reputacion-militar",
    ],
  },
  {
    slug: "imperio-espanol-e-imperio-britanico",
    category: "La Corona y el Gobierno del Imperio",
    title: "Imperio Español e Imperio Británico: semejanzas y diferencias",
    seoTitle: "Imperio Español e Imperio Británico: una comparación",
    description:
      "Comparación histórica entre los imperios español y británico: gobierno, comercio, religión, poblamiento, esclavitud y fiscalidad.",
    lead:
      "Dos imperios globales con cronologías, instituciones y sociedades cambiantes que no caben en modelos nacionales simples.",
    publishedAt: "2026-09-06",
    sourceFile: "Imperio espanol e imperio britanico.txt",
    href: withBase("/papeles-y-tratados/imperio-espanol-e-imperio-britanico"),
    ...responsiveArticleImage("imperio-espanol-britanico", [640, 1024], 1024, 732),
    imageAlt: "Mapa comparativo de la extensión de los imperios español y británico",
    imageCaption: "Comparación cartográfica de ambos imperios en distintos periodos.",
    imageCredit: "Nagihuin",
    imageSource: "Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Size_of_Empires_Spanish_VS_British.svg",
    imageLicense: "CC0 1.0",
    relatedSlugs: [
      "roma-y-la-monarquia-hispanica",
      "una-monarquia-de-reinos-espana-siglos-xvi-xvii",
      "comercio-entre-espana-y-las-indias",
    ],
  },
  {
    slug: "roma-y-la-monarquia-hispanica",
    category: "La Corona y el Gobierno del Imperio",
    title: "Roma y la Monarquía Hispánica: semejanzas y diferencias entre dos imperios",
    seoTitle: "Roma y la Monarquía Hispánica: comparación entre imperios",
    description:
      "Comparación entre Roma y la Monarquía Hispánica en ciudadanía, derecho, administración, ejército, lengua, religión y fiscalidad.",
    lead:
      "Roma fue un modelo cultural constante, pero ciudadanía, gobierno y fronteras pertenecieron a sistemas separados por más de un milenio.",
    publishedAt: "2026-09-06",
    sourceFile: "Roma y la Monarquia Hispanica.txt",
    href: withBase("/papeles-y-tratados/roma-y-la-monarquia-hispanica"),
    ...responsiveArticleImage("roma-monarquia-hispanica", [640, 1024], 1024, 851),
    imageAlt: "Mapa político del Imperio romano durante el reinado de Adriano",
    imageCaption: "Mapa político del Imperio romano en el año 125.",
    imageCredit: "ArdadN y EraNavigator",
    imageSource: "Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Roman_Empire_125_political_map.svg",
    imageLicense: "CC BY-SA 3.0",
    relatedSlugs: [
      "imperio-espanol-e-imperio-britanico",
      "una-monarquia-de-reinos-espana-siglos-xvi-xvii",
      "rey-de-espana-legitimo-emperador-de-roma",
    ],
  },
  {
    slug: "magallanes-elcano-primera-vuelta-al-mundo",
    category: "Expediciones, Rutas y Descubrimientos",
    title: "Magallanes y Elcano: la primera vuelta al mundo",
    seoTitle: "Magallanes y Elcano: historia de la primera vuelta al mundo",
    description:
      "Historia de la expedición de 1519-1522: el proyecto de Magallanes, el estrecho, Mactán y la culminación dirigida por Elcano.",
    lead:
      "Magallanes abrió el paso al Pacífico y Elcano condujo la Victoria de regreso: dos papeles indispensables en una empresa colectiva.",
    publishedAt: "2026-09-06",
    sourceFile: "Magallanes y Elcano.txt",
    href: withBase("/papeles-y-tratados/magallanes-elcano-primera-vuelta-al-mundo"),
    ...responsiveArticleImage("magallanes-elcano", [640, 1024], 1024, 519),
    imageAlt: "Mapa de la ruta de la primera circunnavegación de Magallanes y Elcano",
    imageCaption: "Ruta de la expedición de Magallanes y Elcano, 1519-1522.",
    imageCredit: "Sémhur y Armando-Martin",
    imageSource: "Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Magellan_Elcano_Circumnavigation-es.svg",
    imageLicense: "CC BY-SA 3.0",
    relatedSlugs: [
      "tratado-de-tordesillas-division-del-mundo",
      "comercio-entre-espana-y-las-indias",
      "cagayan-1582-espanoles-japoneses-piratas",
    ],
  },
  {
    slug: "libertadores-americanos-y-espana",
    category: "La Forja de las Indias",
    title: "Los libertadores americanos y España: formación, vínculos y ruptura",
    seoTitle: "Los libertadores americanos y sus vínculos con España",
    description:
      "Los vínculos de Bolívar y San Martín con España, su formación dentro de la Monarquía y la ruptura política de las independencias.",
    lead:
      "Bolívar vivió en Madrid y San Martín sirvió en el Ejército español: la independencia nació dentro de un mundo político compartido.",
    publishedAt: "2026-09-06",
    sourceFile: "Libertadores americanos y Espana.txt",
    href: withBase("/papeles-y-tratados/libertadores-americanos-y-espana"),
    ...responsiveArticleImage("libertadores-americanos", [640, 1024], 1024, 1348),
    imageAlt: "Retrato de Simón Bolívar con uniforme militar pintado por José Gil de Castro",
    imageCaption: "Retrato de Simón Bolívar, ca. 1823-1825.",
    imageCredit: "José Gil de Castro",
    imageSource: "Museo de Arte de Lima / Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Sim%C3%B3n_Bol%C3%ADvar_by_Jos%C3%A9_Gil_de_Castro.jpg",
    imageLicense: "Dominio público",
    relatedSlugs: [
      "vasallos-monarquia-derechos-deberes-indias",
      "12-de-octubre-dia-de-la-hispanidad",
      "una-monarquia-de-reinos-espana-siglos-xvi-xvii",
    ],
  },
  {
    slug: "comercio-entre-espana-y-las-indias",
    category: "Expediciones, Rutas y Descubrimientos",
    title: "Oro, plata, especias y alimentos: las rutas comerciales de Indias",
    seoTitle: "Rutas comerciales entre España y las Indias | Historia",
    description:
      "La Carrera de Indias y el Galeón de Manila: metales, alimentos, manufacturas y personas en una red comercial tempranamente global.",
    lead:
      "De Sevilla y Cádiz a Veracruz, Cartagena, Portobelo, Acapulco y Manila: mercancías, fiscalidad, trabajo y navegación.",
    publishedAt: "2026-09-06",
    sourceFile: "Comercio entre Espana y las Indias.txt",
    href: withBase("/papeles-y-tratados/comercio-entre-espana-y-las-indias"),
    ...responsiveArticleImage("comercio-indias", [640, 1024], 1024, 716),
    imageAlt: "Combate naval de 1708 contra una flota española de Indias frente a Cartagena",
    imageCaption: "Acción de Wager frente a Cartagena, 28 de mayo de 1708.",
    imageCredit: "Samuel Scott",
    imageSource: "Royal Museums Greenwich / Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Wager%27s_Action_off_Cartagena,_28_May_1708.jpg",
    imageLicense: "Dominio público",
    relatedSlugs: [
      "magallanes-elcano-primera-vuelta-al-mundo",
      "tratado-de-tordesillas-division-del-mundo",
      "cartagena-de-indias-1741-blas-de-lezo",
    ],
  },
  {
    slug: "una-monarquia-de-reinos-espana-siglos-xvi-xvii",
    category: "La Corona y el Gobierno del Imperio",
    title: "Una Monarquía de reinos: cómo se organizaba España en los siglos XVI y XVII",
    seoTitle: "Una Monarquía de reinos: España en los siglos XVI y XVII",
    description:
      "Cómo se organizaba la Monarquía Hispánica: Castilla, Aragón, Navarra, fueros, Cortes, consejos, virreyes y fiscalidad.",
    lead:
      "Una corona compartida no eliminaba leyes, Cortes ni derechos propios: la España de los Austrias era una monarquía compuesta.",
    publishedAt: "2026-09-06",
    sourceFile: "Una Monarquia de reinos.txt",
    href: withBase("/papeles-y-tratados/una-monarquia-de-reinos-espana-siglos-xvi-xvii"),
    ...responsiveArticleImage("monarquia-de-reinos", [640, 1024], 1024, 751),
    imageAlt: "Mapa de los reinos de la Península Ibérica durante el Antiguo Régimen",
    imageCaption: "División territorial de la Península durante el Antiguo Régimen.",
    imageCredit: "Tyk, Ángel Luis Alfaro y Milenioscuro",
    imageSource: "Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File:Reinos_Antiguo_R%C3%A9gimen.svg",
    imageLicense: "CC BY-SA 4.0",
    relatedSlugs: [
      "imperio-espanol-e-imperio-britanico",
      "roma-y-la-monarquia-hispanica",
      "el-imperio-donde-nunca-se-pone-el-sol",
    ],
  },
  {
    slug: "cartagena-de-indias-1741-blas-de-lezo",
    category: "Espada, Mar y Frontera",
    title: "Cartagena de Indias, 1741: Blas de Lezo y la defensa del Caribe",
    seoTitle: "Cartagena de Indias 1741: Blas de Lezo y Edward Vernon",
    description:
      "La defensa de Cartagena de Indias frente a Vernon: Blas de Lezo, Sebastián de Eslava, fortificaciones, epidemias y cifras discutidas.",
    lead:
      "Una gran expedición británica fue detenida por una defensa colectiva que la memoria redujo después a un duelo de dos almirantes.",
    publishedAt: "2026-09-06",
    sourceFile: "Cartagena de Indias 1741.txt",
    href: withBase("/papeles-y-tratados/cartagena-de-indias-1741-blas-de-lezo"),
    ...responsiveArticleImage("cartagena-indias-1741", [640, 1024], 1024, 871),
    imageAlt: "Plano de la bahía, ciudad y fortificaciones de Cartagena de Indias durante el ataque de 1741",
    imageCaption: "Plano de la bahía y fortificaciones de Cartagena durante el ataque de 1741.",
    imageCredit: "Anónimo, según diseño de William Laws; Covens & Mortier",
    imageSource: "Rijksmuseum / Wikimedia Commons",
    imageSourceUrl:
      "https://commons.wikimedia.org/wiki/File%3APlattegrond_van_de_omgeving_van_Cartagena_met_de_slag_van_Cartagena%2C_1741_Plan_van_de_haven%2C_stadt_en_kasteelen_van_Cartagena_%28..%29_Plan_du_port%2C_de_la_ville%2C_et_des_forteresses_de_Carthag%C3%A8ne_%28..%29_%28titel_op_object%29%2C_RP-P-2018-1132.jpg",
    imageLicense: "CC0 1.0",
    relatedSlugs: [
      "comercio-entre-espana-y-las-indias",
      "rocroi-1643-mito-fin-tercios",
      "cruz-de-borgona-historia",
    ],
  },
];


export const FOOTER_SOCIAL_LINKS = [
  {
    href: "https://instagram.com",
    label: "Instagram",
    iconPath:
      "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
  },
  {
    href: "https://linkedin.com",
    label: "LinkedIn",
    iconPath:
      "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  },
  {
    href: "https://facebook.com",
    label: "Facebook",
    iconPath:
      "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
];

export const FOOTER_LEGAL_LINKS = [
  { href: withBase("/terminos"), label: "Terminos de Uso" },
  { href: withBase("/privacidad"), label: "Politica de Privacidad" },
];
