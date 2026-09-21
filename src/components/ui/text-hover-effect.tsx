import type { CSSProperties } from "preact";

interface TextHoverEffectProps {
  text: string;
  duration?: number;
  className?: string;
}

export function TextHoverEffect({
  text,
  duration = 0.75,
  className = "",
}: TextHoverEffectProps) {
  const style = {
    "--text-hover-duration": `${duration}s`,
  } as CSSProperties;

  return (
    <span className={`text-hover-effect ${className}`} style={style}>
      <span className="text-hover-effect__base">{text}</span>
      <span className="text-hover-effect__gradient" aria-hidden="true">
        {text}
      </span>
      <span className="text-hover-effect__outline" aria-hidden="true">
        {text}
      </span>
    </span>
  );
}
