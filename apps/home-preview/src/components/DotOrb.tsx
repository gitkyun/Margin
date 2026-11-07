import { useEffect, useRef } from "react";
export function DotOrb({
  active = false,
  size = 110,
}: {
  active?: boolean;
  size?: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0,
      visible = true,
      tick = 0;
    const obs = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
    });
    obs.observe(c);
    function draw() {
      if (!g || !c) return;
      if (visible) {
        const d = window.devicePixelRatio || 1;
        c.width = size * d;
        c.height = size * d;
        g.scale(d, d);
        const color = getComputedStyle(c).color,
          angle = active && !reduce ? tick * 0.007 : 0.2;
        g.clearRect(0, 0, size, size);
        for (let i = 0; i < 180; i++) {
          const y = 1 - (2 * i) / 179,
            r = Math.sqrt(1 - y * y),
            a = i * 2.399963,
            px = Math.cos(a) * r,
            pz = Math.sin(a) * r,
            x = px * Math.cos(angle) + pz * Math.sin(angle),
            z = pz * Math.cos(angle) - px * Math.sin(angle),
            cx = size / 2 + x * size * 0.36,
            cy =
              size / 2 +
              y * size * 0.36 +
              Math.sin(x * 3 + angle) * size * 0.035;
          g.globalAlpha = 0.15 + (z + 1) * 0.35;
          g.fillStyle = color;
          g.beginPath();
          g.arc(cx, cy, 0.6 + (z + 1) * 0.45, 0, Math.PI * 2);
          g.fill();
        }
        tick++;
      }
      if (active && !reduce) frame = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(frame);
      obs.disconnect();
    };
  }, [active, size]);
  return (
    <canvas
      ref={ref}
      className={`dot-orb ${active ? "active" : ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    />
  );
}
