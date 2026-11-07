import type { CSSProperties } from "react";

/** Supplied Margin artwork. The light/dark assets retain their original paths. */
export function BrandMark({
  className = "",
  inverse = false,
}: {
  className?: string;
  inverse?: boolean;
}) {
  return (
    <span className={`margin-brand-mark ${className}`} aria-hidden="true">
      <img
        className={inverse ? "" : "margin-theme-light"}
        src={inverse ? "/brand/symbol-white.svg" : "/brand/symbol-blue.svg"}
        alt=""
        width="160"
        height="170"
      />
      {!inverse && (
        <img
          className="margin-theme-dark"
          src="/brand/symbol-white.svg"
          alt=""
          width="160"
          height="170"
        />
      )}
    </span>
  );
}

export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`margin-wordmark ${className}`}
      role="img"
      aria-label="Margin"
    >
      <img
        className="margin-theme-light"
        src="/brand/wordmark-blue.svg"
        alt=""
        width="421"
        height="132"
      />
      <img
        className="margin-theme-dark"
        src="/brand/wordmark-white.svg"
        alt=""
        width="421"
        height="132"
      />
    </span>
  );
}

export const mascotImages = {
  idle: "01_idle",
  ready: "02_ready",
  question: "03_question",
  rest: "04_rest",
  working: "05_working",
  thinking: "06_thinking",
  searching: "07_searching",
  idea: "08_idea",
  chatting: "09_chatting",
  processing: "10_processing",
  analyzing: "11_analyzing",
  writing: "12_writing",
  completed: "13_completed",
  happy: "14_happy",
  approved: "15_approved",
  attention: "16_attention",
} as const;
export type MascotState = keyof typeof mascotImages;

/** Decorative companion: adjacent text always carries the actual status. */
export function AssistantMascot({
  state = "idle",
  size = 40,
  active = false,
  className = "",
  eager = false,
}: {
  state?: MascotState;
  size?: number;
  active?: boolean;
  className?: string;
  eager?: boolean;
}) {
  return (
    <span
      className={`margin-mascot ${active ? "is-working" : ""} ${className}`}
      style={{ "--mascot-size": `${size}px` } as CSSProperties}
      aria-hidden="true"
    >
      <img
        src={`/brand/mascot/${mascotImages[state]}.png`}
        alt=""
        width="1024"
        height="1024"
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
