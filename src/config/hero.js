import { withBase } from "../utils/basePath";

const preloaderSourceSet = (name, extension) => {
  const widths = [1280, 1920];
  return widths
    .map((width) => {
      return `${withBase(`/images/preloader/${name}-${width}.${extension}`)} ${width}w`;
    })
    .join(", ");
};

const mobilePreloaderSourceSet = (name, extension, widths = [480, 640]) =>
  widths
    .map(
      (width) =>
        `${withBase(`/images/preloader/Preload%20movil/${name}-${width}.${extension}`)} ${width}w`
    )
    .join(", ");

const compactMobilePreloaderSource = (name, extension) =>
  withBase(`/images/preloader/Preload%20movil/${name}-480.${extension}`);

export const HERO_VIEW_TRANSITION_NAME = "imperio-preloader-hero";
export const PRELOADER_SESSION_KEY = "imperio-preloader-seen";
export const HERO_IMAGE_DEFAULT_SRC = withBase("/images/preloader/Preload_6_def_upscaled_2x-1920.webp");
export const HERO_IMAGE_AVIF_SRC_SET = preloaderSourceSet(
  "Preload_6_def_upscaled_2x",
  "avif"
);
export const HERO_IMAGE_WEBP_SRC_SET = preloaderSourceSet(
  "Preload_6_def_upscaled_2x",
  "webp"
);
export const HERO_IMAGE_MOBILE_SRC = mobilePreloaderSourceSet(
  "06_preloader_phone",
  "webp",
  [480, 768]
);
export const HERO_IMAGE_MOBILE_AVIF_SRC = mobilePreloaderSourceSet(
  "06_preloader_phone",
  "avif",
  [480, 768]
);

export const HERO_LAYER_VARS = {
  "--imperio-x": "0px",
  "--imperio-y": "0px",
  "--imperio-opacity": 1,
  "--espanol-x": "0px",
  "--espanol-y": "0px",
  "--espanol-opacity": 1,
  "--latin-x": "0px",
  "--latin-y": "0px",
  "--latin-opacity": 0.9,
};

export const HERO_ENTRANCE_SEQUENCE = {
  wordmarkDelayMs: 180,
  navBandDelayMs: 850,
  latinDelayMs: 1600,
};

export const LATIN_LAYER_SEQUENCE = [
  { id: "Non_sufficit_orbis", label: "Non sufficit orbis" },
  { id: "Plus_ultra", label: "Plus ultra" },
  { id: "A_solis_ortu_usque_ad_occasum", label: "A solis ortu usque ad occasum", scale: 2 },
  { id: "Fiat_justitia_et_pereat_mundus", label: "Fiat justitia et pereat mundus", scale: 2 },
  { id: "Ante_ferit_quam_flamma_micet", label: "Ante ferit quam flamma micet", scale: 2 },
  { id: "Nec_spe_nec_metu", label: "Nec spe nec metu", scale: 2 },
  { id: "Iam_illvstrabit_omnia", label: "Iam illvstrabit omnia", scale: 2 },
  { id: "Pace_mare_terraqve_composita", label: "Pace mare terraqve composita", scale: 2 },
  { id: "Fidei_defensor", label: "Fidei defensor", scale: 2 },
];

export const LATIN_LAYER_ANIMATION = {
  startDelayMs: 120,
  revealMs: 1400,
  glyphInMs: 2000,
  inFadeDelayRatio: 0.84,
  inPreviewLeadRatio: 0.08,
  inBlurEndRatio: 0.78,
  inPreviewOpacity: 0.62,
  holdMs: 4000,
  outSweepMs: 1400,
  glyphOutMs: 2000,
  outFadeDelayRatio: 0.9,
  staggerMs: 10000,
  loopPauseMs: 0,
  maxBlurPx: 10,
};

export const PRELOADER_SEQUENCE_IMAGES = [
  {
    src: withBase("/images/preloader/Preload_1_def_upscaled_2x-1920.webp"),
    avifSrcSet: preloaderSourceSet("Preload_1_def_upscaled_2x", "avif"),
    webpSrcSet: preloaderSourceSet("Preload_1_def_upscaled_2x", "webp"),
    mobileSrcSet: mobilePreloaderSourceSet("01_preloader_phone", "webp"),
    mobileAvifSrcSet: mobilePreloaderSourceSet("01_preloader_phone", "avif"),
    compactMobileSrc: compactMobilePreloaderSource("01_preloader_phone", "webp"),
    compactMobileAvifSrc: compactMobilePreloaderSource("01_preloader_phone", "avif"),
    alt: "Cargando 1",
    scaleEnd: "1",
  },
  {
    src: withBase("/images/preloader/Preload_2_def_upscaled_2x-1920.webp"),
    avifSrcSet: preloaderSourceSet("Preload_2_def_upscaled_2x", "avif"),
    webpSrcSet: preloaderSourceSet("Preload_2_def_upscaled_2x", "webp"),
    mobileSrcSet: mobilePreloaderSourceSet("02_preloader_phone", "webp"),
    mobileAvifSrcSet: mobilePreloaderSourceSet("02_preloader_phone", "avif"),
    compactMobileSrc: compactMobilePreloaderSource("02_preloader_phone", "webp"),
    compactMobileAvifSrc: compactMobilePreloaderSource("02_preloader_phone", "avif"),
    alt: "Cargando 2",
    scaleEnd: "0.988",
  },
  {
    src: withBase("/images/preloader/Preload_Archivo-1920.webp"),
    avifSrcSet: preloaderSourceSet("Preload_Archivo", "avif"),
    webpSrcSet: preloaderSourceSet("Preload_Archivo", "webp"),
    mobileSrcSet: mobilePreloaderSourceSet("preload_archivo_phone", "webp"),
    mobileAvifSrcSet: mobilePreloaderSourceSet("preload_archivo_phone", "avif"),
    compactMobileSrc: compactMobilePreloaderSource("preload_archivo_phone", "webp"),
    compactMobileAvifSrc: compactMobilePreloaderSource("preload_archivo_phone", "avif"),
    alt: "Cargando archivo",
    width: 1920,
    height: 1080,
    scaleEnd: "0.976",
  },
  {
    src: withBase("/images/preloader/Preload_4_def_upscaled_2x-1920.webp"),
    avifSrcSet: preloaderSourceSet("Preload_4_def_upscaled_2x", "avif"),
    webpSrcSet: preloaderSourceSet("Preload_4_def_upscaled_2x", "webp"),
    mobileSrcSet: mobilePreloaderSourceSet("04_preloader_phone", "webp"),
    mobileAvifSrcSet: mobilePreloaderSourceSet("04_preloader_phone", "avif"),
    compactMobileSrc: compactMobilePreloaderSource("04_preloader_phone", "webp"),
    compactMobileAvifSrc: compactMobilePreloaderSource("04_preloader_phone", "avif"),
    alt: "Cargando 4",
    scaleEnd: "0.964",
  },
  {
    src: withBase("/images/preloader/Preload_5_def_upscaled_2x-1920.webp"),
    avifSrcSet: preloaderSourceSet("Preload_5_def_upscaled_2x", "avif"),
    webpSrcSet: preloaderSourceSet("Preload_5_def_upscaled_2x", "webp"),
    mobileSrcSet: mobilePreloaderSourceSet("05_preloader_phone", "webp"),
    mobileAvifSrcSet: mobilePreloaderSourceSet("05_preloader_phone", "avif"),
    compactMobileSrc: compactMobilePreloaderSource("05_preloader_phone", "webp"),
    compactMobileAvifSrc: compactMobilePreloaderSource("05_preloader_phone", "avif"),
    alt: "Cargando 5",
    scaleEnd: "0.952",
  },
  {
    src: withBase("/images/preloader/Preload_3_def_upscaled_2x-1920.webp"),
    avifSrcSet: preloaderSourceSet("Preload_3_def_upscaled_2x", "avif"),
    webpSrcSet: preloaderSourceSet("Preload_3_def_upscaled_2x", "webp"),
    mobileSrcSet: mobilePreloaderSourceSet("03_preloader_phone", "webp"),
    mobileAvifSrcSet: mobilePreloaderSourceSet("03_preloader_phone", "avif"),
    compactMobileSrc: compactMobilePreloaderSource("03_preloader_phone", "webp"),
    compactMobileAvifSrc: compactMobilePreloaderSource("03_preloader_phone", "avif"),
    alt: "Cargando 6",
    scaleEnd: "0.94",
    shrinkTrigger: true,
  },
];
