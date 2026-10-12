import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { withBase } from "../utils/basePath";

const DEFAULT_LAYERS = [
  { id: "Non_sufficit_orbis", label: "Non sufficit orbis" },
  { id: "Plus_ultra", label: "Plus ultra" },
  { id: "A_solis_ortu_usque_ad_occasum", label: "A solis ortu usque ad occasum" },
  {
    id: "Fiat_justitia_et_pereat_mundus",
    label: "Fiat justitia et pereat mundus",
  },
  {
    id: "Ante_ferit_quam_flamma_micet",
    label: "Ante ferit quam flamma micet",
  },
  { id: "Nec_spe_nec_metu", label: "Nec spe nec metu" },
  { id: "Iam_illvstrabit_omnia", label: "Iam illvstrabit omnia" },
  {
    id: "Pace_mare_terraqve_composita",
    label: "Pace mare terraqve composita",
  },
  { id: "Fidei_defensor", label: "Fidei defensor" },
];

const DEFAULT_ANIMATION = {
  startDelayMs: 420, // Espera tras preloader antes de arrancar el primer ciclo
  revealMs: 1400, // Barrido de entrada izquierda -> derecha
  glyphInMs: 340, // Duracion de transicion blur/fade-in por glifo
  inFadeDelayRatio: 0.62, // % de la fase de entrada reservado solo a blur
  inPreviewLeadRatio: 0.12, // Momento temprano en que se activa visibilidad del blur-in
  inBlurEndRatio: 0.52, // Punto dentro de entrada donde termina el blur-in
  inPreviewOpacity: 0.18, // Opacidad baja para que se perciba el blur-in antes del fade principal
  holdMs: 2200, // Tiempo totalmente visible (sin blur)
  outSweepMs: 1400, // Barrido de salida izquierda -> derecha
  glyphOutMs: 360, // Duracion de transicion blur/fade-out por glifo
  outFadeDelayRatio: 0.62, // % de la fase de salida reservado solo a blur
  staggerMs: 760, // Separacion entre inicio de cada frase
  loopPauseMs: 5000, // Pausa final antes de reiniciar todo el ciclo
  maxBlurPx: 8,
};

const roundPct = (value) => Number(value.toFixed(3));
const roundValue = (value, decimals = 3) => Number(value.toFixed(decimals));
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default function LatinLayers({
  src = withBase("/images/Letras_latin.svg"),
  layers = DEFAULT_LAYERS,
  animation = DEFAULT_ANIMATION,
  className = "",
}) {
  const [svgMarkup, setSvgMarkup] = useState("");
  const wrapperRef = useRef(null);

  const activeLayers = useMemo(
    () => (Array.isArray(layers) ? layers.filter((layer) => layer?.id) : []),
    [layers]
  );
  const anim = useMemo(
    () => ({ ...DEFAULT_ANIMATION, ...(animation || {}) }),
    [animation]
  );

  const timeline = useMemo(() => {
    const layerCount = Math.max(1, activeLayers.length);
    const glyphInMs = Math.max(
      120,
      toNumber(anim.glyphInMs, Math.round(anim.revealMs * 0.24))
    );
    const glyphOutMs = Math.max(
      120,
      toNumber(anim.glyphOutMs, toNumber(anim.fadeMs, 360))
    );
    const outSweepMs = Math.max(120, toNumber(anim.outSweepMs, anim.revealMs));
    const phraseWindowMs =
      anim.revealMs + glyphInMs + anim.holdMs + outSweepMs + glyphOutMs;
    const cycleDurationMs =
      phraseWindowMs +
      (layerCount - 1) * anim.staggerMs +
      anim.loopPauseMs;

    return {
      cycleDurationMs,
      phraseWindowMs,
      glyphInMs,
      outSweepMs,
      glyphOutMs,
    };
  }, [activeLayers.length, anim]);

  useEffect(() => {
    let isCancelled = false;

    const loadSvg = async () => {
      try {
        const response = await fetch(src, { cache: "force-cache" });
        if (!response.ok) return;
        const rawSvg = await response.text();
        if (isCancelled) return;

        if (typeof DOMParser === "undefined") {
          setSvgMarkup(rawSvg);
          return;
        }

        const parser = new DOMParser();
        const doc = parser.parseFromString(rawSvg, "image/svg+xml");
        const root = doc.documentElement;
        const existingClass = root.getAttribute("class") || "";
        root.setAttribute(
          "class",
          [existingClass, "latin-layers__svg"].filter(Boolean).join(" ")
        );
        root.setAttribute("aria-hidden", "true");
        root.setAttribute("focusable", "false");
        root.setAttribute("overflow", "visible");

        const layerMap = new Map(
          activeLayers.map((layer, index) => [layer.id, { ...layer, index }])
        );
        const verticalReferenceLayer =
          activeLayers.find(
            (layer) => layer?.id === "Plus_ultra" && layer.enabled !== false
          ) ||
          activeLayers.find((layer) => layer?.id && layer.enabled !== false);
        const referenceGroup = verticalReferenceLayer
          ? root.querySelector(`g[id="${verticalReferenceLayer.id}"]`)
          : null;
        const referenceRect = referenceGroup?.querySelector("rect");
        const baseHeight = Math.max(
          1,
          toNumber(referenceRect?.getAttribute("height"), 1)
        );

        root.querySelectorAll("g[id]").forEach((group) => {
          const id = group.getAttribute("id");
          const layerConfig = layerMap.get(id);
          const groupClass = group.getAttribute("class") || "";

          if (!layerConfig || layerConfig.enabled === false) {
            group.setAttribute(
              "class",
              [groupClass, "latin-phrase-layer", "latin-phrase-layer--off"]
                .filter(Boolean)
                .join(" ")
            );
            return;
          }

          const extraDelayMs = Number(layerConfig.extraDelayMs || 0);
          const manualShiftX = toNumber(layerConfig.shiftX, 0);
          const manualShiftY = toNumber(layerConfig.shiftY, 0);
          const layerDelayMs =
            layerConfig.index * anim.staggerMs + extraDelayMs;
          const rowRect = group.querySelector("rect");
          const rowHeight = Math.max(
            1,
            toNumber(rowRect?.getAttribute("height"), baseHeight)
          );
          const manualScale = Math.max(0.1, toNumber(layerConfig.scale, 1));
          const layerScale = roundValue(
            (baseHeight / rowHeight) * manualScale,
            6
          );
          const existingStyle = group.getAttribute("style");
          const nextStyle = [
            existingStyle?.trim()?.replace(/;$/, ""),
            `--layer-delay-ms:${layerDelayMs}ms`,
            `--layer-offset-x:${roundValue(manualShiftX, 4)}px`,
            `--layer-offset-y:${roundValue(manualShiftY, 4)}px`,
            `--layer-scale:${layerScale}`,
          ]
            .filter(Boolean)
            .join(";");

          let contentGroup = group.querySelector(":scope > g.latin-phrase-layer__content");
          if (!contentGroup) {
            contentGroup = doc.createElementNS("http://www.w3.org/2000/svg", "g");
            contentGroup.setAttribute("class", "latin-phrase-layer__content");
            const directGlyphNodes = Array.from(group.querySelectorAll(":scope > path"));
            directGlyphNodes.forEach((glyphNode) => {
              contentGroup.appendChild(glyphNode);
            });
            group.appendChild(contentGroup);
          }

          const glyphNodes = Array.from(contentGroup.querySelectorAll("path"));
          glyphNodes.forEach((glyphNode) => {
            const glyphClass = glyphNode.getAttribute("class") || "";
            glyphNode.setAttribute(
              "class",
              [glyphClass, "latin-glyph"]
                .filter(Boolean)
                .join(" ")
            );
          });

          group.setAttribute("style", nextStyle);
          group.setAttribute(
            "class",
            [groupClass, "latin-phrase-layer"].filter(Boolean).join(" ")
          );
          group.setAttribute("data-layer-id", id);
          group.setAttribute("data-layer-label", layerConfig.label || id);
        });

        setSvgMarkup(root.outerHTML);
      } catch {
        setSvgMarkup("");
      }
    };

    loadSvg();
    return () => {
      isCancelled = true;
    };
  }, [src, activeLayers, anim.staggerMs]);

  useEffect(() => {
    if (!svgMarkup || !wrapperRef.current) return;

    const root = wrapperRef.current.querySelector("svg.latin-layers__svg");
    if (!root) return;

    const enabledLayers = activeLayers.filter((layer) => layer.enabled !== false);
    if (!enabledLayers.length) return;

    let targetCenterX = 0;
    try {
      const viewBox = root.viewBox?.baseVal;
      if (viewBox && Number.isFinite(viewBox.width) && viewBox.width > 0) {
        targetCenterX = viewBox.x + viewBox.width / 2;
      } else {
        const rootBox = root.getBBox();
        targetCenterX = rootBox.x + rootBox.width / 2;
      }
    } catch {
      return;
    }

    const getGlyphBounds = (group) => {
      const glyphNodes = Array.from(
        group.querySelectorAll("path.latin-glyph, path")
      );
      let minX = Number.POSITIVE_INFINITY;
      let minY = Number.POSITIVE_INFINITY;
      let maxX = Number.NEGATIVE_INFINITY;
      let maxY = Number.NEGATIVE_INFINITY;

      glyphNodes.forEach((glyphNode) => {
        if (typeof glyphNode.getBBox !== "function") return;
        try {
          const box = glyphNode.getBBox();
          if (!Number.isFinite(box.width) || !Number.isFinite(box.height)) return;
          minX = Math.min(minX, box.x);
          minY = Math.min(minY, box.y);
          maxX = Math.max(maxX, box.x + box.width);
          maxY = Math.max(maxY, box.y + box.height);
        } catch {
          // Ignore malformed glyph bounds and continue with the rest.
        }
      });

      if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;

      return {
        x: minX,
        y: minY,
        width: Math.max(1, maxX - minX),
        height: Math.max(1, maxY - minY),
      };
    };

    const verticalReferenceLayer =
      enabledLayers.find(
        (layer) => layer?.id === "Plus_ultra" && layer.enabled !== false
      ) || enabledLayers[0];
    const verticalReferenceGroup = verticalReferenceLayer
      ? root.querySelector(`g[data-layer-id="${verticalReferenceLayer.id}"]`)
      : null;
    const verticalReferenceBounds = verticalReferenceGroup
      ? getGlyphBounds(verticalReferenceGroup)
      : null;
    const targetTopY = verticalReferenceBounds?.y ?? 0;

    const clampPct = (value) => Math.min(100, Math.max(0, roundPct(value)));
    const animations = [];

    enabledLayers.forEach((layer, layerIndex) => {
      const group = root.querySelector(`g[data-layer-id="${layer.id}"]`);
      if (!group || typeof group.getBBox !== "function") return;

      const manualShiftX = toNumber(layer.shiftX, 0);
      const manualShiftY = toNumber(layer.shiftY, 0);
      const extraDelayMs = toNumber(layer.extraDelayMs, 0);
      let groupBox = null;
      let centerDeltaX = 0;
      let topDeltaY = 0;

      groupBox = getGlyphBounds(group);
      if (groupBox) {
        centerDeltaX = targetCenterX - (groupBox.x + groupBox.width / 2);
        topDeltaY = targetTopY - groupBox.y;
      }

      group.style.setProperty(
        "--layer-offset-x",
        `${roundValue(centerDeltaX + manualShiftX, 4)}px`
      );
      group.style.setProperty(
        "--layer-offset-y",
        `${roundValue(topDeltaY + manualShiftY, 4)}px`
      );

      if (!groupBox) return;

      const layerStartMs = layerIndex * anim.staggerMs + extraDelayMs;
      const outBaseMs =
        layerStartMs + anim.revealMs + timeline.glyphInMs + anim.holdMs;
      const inDelayRatio = Math.min(
        0.9,
        Math.max(0, toNumber(anim.inFadeDelayRatio, 0.62))
      );
      const inPreviewLeadRatio = Math.min(
        0.45,
        Math.max(0.02, toNumber(anim.inPreviewLeadRatio, 0.12))
      );
      const inBlurEndRatio = Math.min(
        0.9,
        Math.max(0.05, toNumber(anim.inBlurEndRatio, 0.52))
      );
      const inPreviewOpacity = Math.min(
        0.5,
        Math.max(0.05, toNumber(anim.inPreviewOpacity, 0.18))
      );
      const outDelayRatio = Math.min(
        0.9,
        Math.max(0, toNumber(anim.outFadeDelayRatio, 0.62))
      );
      const glyphNodes = Array.from(group.querySelectorAll("path.latin-glyph"));
      const groupWidth = Math.max(1, groupBox.width);
      const groupLeft = groupBox.x;

      glyphNodes.forEach((glyphNode) => {
        if (typeof glyphNode.getBBox !== "function") return;

        let glyphBox = null;
        try {
          glyphBox = glyphNode.getBBox();
        } catch {
          glyphBox = null;
        }
        if (!glyphBox) return;

        const glyphCenterX = glyphBox.x + glyphBox.width / 2;
        const xNorm = Math.min(
          1,
          Math.max(0, (glyphCenterX - groupLeft) / groupWidth)
        );

        const inStartMs = layerStartMs + xNorm * anim.revealMs;
        const inEndMs = inStartMs + timeline.glyphInMs;
        const outStartMs = outBaseMs + xNorm * timeline.outSweepMs;
        const outEndMs = outStartMs + timeline.glyphOutMs;

        const inStartPct = clampPct((inStartMs / timeline.cycleDurationMs) * 100);
        const inEndPct = clampPct((inEndMs / timeline.cycleDurationMs) * 100);
        const outStartPct = clampPct(
          (outStartMs / timeline.cycleDurationMs) * 100
        );
        const outEndPct = clampPct((outEndMs / timeline.cycleDurationMs) * 100);
        const safeInEndPct = Math.max(inEndPct, inStartPct + 0.01);
        const safeOutStartPct = Math.max(outStartPct, safeInEndPct + 0.01);
        const safeOutEndPct = Math.max(outEndPct, safeOutStartPct + 0.01);
        const inFadeStartPct = clampPct(
          inStartPct + (safeInEndPct - inStartPct) * inDelayRatio
        );
        const inBlurEndPct = clampPct(
          inStartPct + (safeInEndPct - inStartPct) * inBlurEndRatio
        );
        const inPreviewOnPct = clampPct(
          inStartPct + (safeInEndPct - inStartPct) * inPreviewLeadRatio
        );
        const outFadeStartPct = clampPct(
          safeOutStartPct + (safeOutEndPct - safeOutStartPct) * outDelayRatio
        );
        const safeInFadeStartPct = Math.max(
          inStartPct + 0.01,
          Math.min(safeInEndPct - 0.01, inFadeStartPct)
        );
        const safeInBlurEndPct = Math.max(
          inStartPct + 0.01,
          Math.min(safeInFadeStartPct - 0.01, inBlurEndPct)
        );
        const safeInPreviewOnPct = Math.max(
          inStartPct + 0.01,
          Math.min(safeInBlurEndPct - 0.01, inPreviewOnPct)
        );
        const safeOutFadeStartPct = Math.max(
          safeOutStartPct + 0.01,
          Math.min(safeOutEndPct - 0.01, outFadeStartPct)
        );

        const hiddenFilter = `blur(${anim.maxBlurPx}px)`;
        const animation = glyphNode.animate(
          [
            { offset: 0, opacity: 0, filter: hiddenFilter },
            { offset: inStartPct / 100, opacity: 0, filter: hiddenFilter },
            { offset: safeInPreviewOnPct / 100, opacity: inPreviewOpacity, filter: hiddenFilter },
            { offset: safeInBlurEndPct / 100, opacity: inPreviewOpacity, filter: "blur(0px)" },
            { offset: safeInFadeStartPct / 100, opacity: inPreviewOpacity, filter: "blur(0px)" },
            { offset: safeInEndPct / 100, opacity: 1, filter: "blur(0px)" },
            { offset: safeOutStartPct / 100, opacity: 1, filter: "blur(0px)" },
            { offset: safeOutFadeStartPct / 100, opacity: 1, filter: hiddenFilter },
            { offset: safeOutEndPct / 100, opacity: 0, filter: hiddenFilter },
            { offset: 1, opacity: 0, filter: hiddenFilter },
          ],
          {
            duration: timeline.cycleDurationMs,
            delay: anim.startDelayMs,
            iterations: Infinity,
            easing: "linear",
            fill: "both",
          }
        );
        animation.pause();
        animations.push(animation);
      });
    });

    const hero = wrapperRef.current.closest(".hero-imperio");
    const playAnimations = () => {
      if (!hero?.classList.contains("hero-imperio--latin-ready")) return false;
      animations.forEach((animation) => animation.play());
      return true;
    };
    const observer = playAnimations()
      ? null
      : new MutationObserver(() => {
          if (playAnimations()) observer?.disconnect();
        });
    if (hero) {
      observer?.observe(hero, { attributes: true, attributeFilter: ["class"] });
    }

    return () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
    };
  }, [svgMarkup, activeLayers, anim, timeline]);

  const wrapperClassName = useMemo(
    () =>
      ["latin-layers", className, svgMarkup ? "latin-layers--ready" : ""]
        .filter(Boolean)
        .join(" "),
    [className, svgMarkup]
  );

  return (
    <div
      ref={wrapperRef}
      class={wrapperClassName}
      style={{
        "--latin-max-blur-px": `${anim.maxBlurPx}px`,
      }}
      aria-hidden="true"
    >
      {svgMarkup && (
        <div
          class="latin-layers__svg-wrap"
          dangerouslySetInnerHTML={{ __html: svgMarkup }}
        />
      )}

      <style>{`
        .latin-layers {
          --latin-responsive-scale: 1;
          width: 100%;
          pointer-events: none;
        }

        .latin-layers__svg-wrap {
          width: 100%;
          overflow: visible;
        }

        .latin-layers__svg {
          display: block;
          width: 100%;
          height: auto;
          overflow: visible;
        }

        .latin-phrase-layer {
          transform: translateX(var(--layer-offset-x, 0px))
            translateY(var(--layer-offset-y, 0px));
          will-change: transform;
        }

        .latin-phrase-layer__content {
          transform-box: fill-box;
          transform-origin: center top;
          transform: scale(calc(var(--layer-scale, 1) * var(--latin-responsive-scale, 1)));
          will-change: transform;
        }

        .latin-phrase-layer--off {
          opacity: 0 !important;
          display: none;
        }

        .latin-glyph {
          opacity: 0;
          filter: blur(var(--latin-max-blur-px));
          will-change: opacity, filter;
        }

        @media (max-width: 768px) {
          .latin-layers {
            --latin-responsive-scale: 0.64;
          }

          .latin-layers__svg-wrap,
          .latin-layers__svg {
            overflow: hidden;
          }
        }

      `}</style>
    </div>
  );
}
