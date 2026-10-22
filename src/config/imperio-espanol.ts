export const IMPERIO_ESPANOL_META = {
  title: "Imperio español: historia, mapa, territorios y legado | Imperio E",
  description:
    "Historia del Imperio español: formación, territorios, gobierno, comercio, cultura, crisis, independencias y legado, con cronología, mapas y fuentes.",
  heading: "Imperio español: historia, territorios y legado",
  canonicalPath: "/imperio-espanol",
} as const;

export const IMPERIO_ESPANOL_CHRONOLOGY = [
  { year: "1469", text: "Matrimonio de Isabel de Castilla y Fernando de Aragón. La unión fue dinástica: cada corona conservó leyes e instituciones propias." },
  { year: "1492", text: "Conquista de Granada y primer viaje de Cristóbal Colón. Es una fecha convencional para explicar el comienzo de la expansión ultramarina." },
  { year: "1494", text: "El Tratado de Tordesillas delimitó áreas de expansión de las coronas de Castilla y Portugal." },
  { year: "1516", text: "Carlos I reunió las coronas de Castilla y Aragón junto con otras herencias dinásticas." },
  { year: "1519-1522", text: "La expedición iniciada por Magallanes y culminada por Elcano completó la primera circunnavegación." },
  { year: "1565", text: "El tornaviaje de Urdaneta permitió consolidar la conexión transpacífica entre Filipinas y Nueva España." },
  { year: "1580-1640", text: "Las coronas de España y Portugal compartieron soberano durante la unión dinástica ibérica." },
  { year: "1700-1714", text: "La Guerra de Sucesión y los tratados de Utrecht transformaron el equilibrio europeo de la Monarquía." },
  { year: "1808", text: "La crisis de la Monarquía abrió procesos políticos y militares decisivos en la Península y América." },
  { year: "1824", text: "Tras Ayacucho, la mayor parte de los territorios continentales americanos había dejado de pertenecer a la Monarquía española." },
  { year: "1898", text: "España perdió Cuba, Puerto Rico y Filipinas tras la guerra con Estados Unidos." },
] as const;

export const IMPERIO_ESPANOL_SOURCES = [
  {
    title: "El Imperio español",
    institution: "Ministerio de Cultura",
    url: "https://www.cultura.gob.es/cultura/archivos/difusion/mc-difusion/bicentenarios/contexto-historico/imperio-espanol.html",
  },
  {
    title: "Historia de la Monarquía Hispánica",
    institution: "Casa de S. M. el Rey",
    url: "https://www.casareal.es/ES/MonarquiaHistoria/Paginas/historia-monarquia.aspx",
  },
  {
    title: "La gobernación de la Monarquía de España",
    institution: "Centro de Estudios Políticos y Constitucionales",
    url: "https://www.cepc.gob.es/publicaciones/monografias/la-gobernacion-de-la-monarquia-de-espana-consejos-juntas-y-secretarios-de-la-administracion-de-corte-6",
  },
  {
    title: "Casa de la Contratación y cartografía",
    institution: "Portal de Archivos Españoles (PARES)",
    url: "https://pares.cultura.gob.es/ParesBusquedas20/catalogo/description/1859528/imprimir",
  },
  {
    title: "Miguel de Cervantes: de la vida al mito",
    institution: "Biblioteca Nacional de España",
    url: "https://cervantes.bne.es/es/exposicion/exposicion",
  },
] as const;

export const IMPERIO_ESPANOL_RELATED = [
  { href: "/papeles-y-tratados/una-monarquia-de-reinos-espana-siglos-xvi-xvii", title: "Una Monarquía de reinos", topic: "Gobierno" },
  { href: "/papeles-y-tratados/el-imperio-donde-nunca-se-pone-el-sol", title: "El imperio donde nunca se pone el sol", topic: "Expansión" },
  { href: "/papeles-y-tratados/tratado-de-tordesillas-division-del-mundo", title: "El Tratado de Tordesillas", topic: "Diplomacia" },
  { href: "/papeles-y-tratados/magallanes-elcano-primera-vuelta-al-mundo", title: "Magallanes y Elcano", topic: "Exploración" },
  { href: "/papeles-y-tratados/comercio-entre-espana-y-las-indias", title: "Comercio entre España y las Indias", topic: "Economía" },
  { href: "/papeles-y-tratados/carlos-v-y-la-justicia-de-la-conquista", title: "Carlos V y la justicia de la conquista", topic: "Debate" },
  { href: "/papeles-y-tratados/libertadores-americanos-y-espana", title: "Libertadores americanos y España", topic: "Independencias" },
  { href: "/papeles-y-tratados/el-espanol-inquebrantable-reputacion-militar", title: "La reputación militar española", topic: "Ejército" },
] as const;

export const IMPERIO_ESPANOL_FAQ = [
  {
    question: "¿Qué fue el Imperio español?",
    answer: "Fue el conjunto cambiante de reinos, territorios y dominios vinculados a la Monarquía Hispánica y gobernados por un mismo soberano mediante instituciones diferentes. No fue un Estado uniforme con una única administración.",
  },
  {
    question: "¿Cuándo comenzó y terminó?",
    answer: "No existe una única periodización. 1492 se usa con frecuencia para explicar el inicio de la expansión americana y 1898 para el final de su gran dimensión ultramarina, aunque España conservó territorios africanos durante el siglo XX.",
  },
  {
    question: "¿Qué territorios abarcó?",
    answer: "A lo largo de distintos siglos incluyó territorios en Europa, América, Asia-Pacífico y África. Un mapa histórico riguroso debe indicar fecha, porque esos dominios no pertenecieron todos a la Monarquía al mismo tiempo.",
  },
  {
    question: "¿Imperio español y Monarquía Hispánica significan lo mismo?",
    answer: "Se solapan, pero no siempre son equivalentes. Monarquía Hispánica ayuda a describir la estructura política compuesta de los siglos XVI y XVII; Imperio español suele enfatizar su dimensión territorial y ultramarina.",
  },
  {
    question: "¿Por qué se desintegró?",
    answer: "No hubo una sola causa. Pesaron las guerras europeas, la fiscalidad, las reformas administrativas, las disputas comerciales, la crisis dinástica de 1808 y los procesos revolucionarios e independentistas americanos.",
  },
] as const;
