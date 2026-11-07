import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";

/** Decorative field: the footer remains the pointer target, so links stay usable. */
export function FooterDotField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let scale = 1;
    let frame = 0;
    let visible = false;
    let lost = false;
    let previous = 0;
    let elapsed = 0;
    let pointer = { x: -1000, y: -1000 };
    let smoothed = { x: -1000, y: -1000 };
    const dark = resolvedTheme === "dark";

    function draw(time: number) {
      if (!context || !width || !height || lost) return;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width, height);
      const spacing = width < 600 ? 8 : 9;
      const phase = reduced.matches ? 0 : time * 0.00016;
      const sideWidth = Math.max(150, width * 0.26);
      for (let y = 3; y < height; y += spacing) {
        for (let x = 3; x < width; x += spacing) {
          const edge = Math.max(
            Math.exp(-Math.pow(x / sideWidth, 2)),
            Math.exp(-Math.pow((width - x) / sideWidth, 2)),
          );
          const lower = Math.pow(y / height, 2) * 0.6;
          const upper = Math.exp(-Math.pow(y / 130, 2)) * 0.45;
          const field = Math.min(1, edge + lower + upper);
          if (field < 0.075) continue;
          const wave = Math.sin(x * 0.018 + y * 0.014 - phase);
          const crosswave = Math.cos(x * 0.009 - y * 0.019 + phase * 0.7);
          let dx = wave * 2.2;
          let dy = crosswave * 2.2;
          let highlight = 0;
          if (!reduced.matches) {
            const px = x - smoothed.x;
            const py = y - smoothed.y;
            const distance = Math.hypot(px, py);
            if (distance < 150 && distance > 0) {
              const influence = Math.pow(1 - distance / 150, 2);
              dx += (px / distance) * influence * 13;
              dy += (py / distance) * influence * 13;
              highlight = influence * 0.35;
            }
          }
          const waveMix = (wave + crosswave + 2) / 4;
          const red = Math.round((dark ? 82 : 76) + waveMix * 25);
          const green = Math.round((dark ? 126 : 140) + waveMix * 35);
          const blue = Math.round((dark ? 205 : 218) + waveMix * 30);
          context.globalAlpha = Math.min(
            0.72,
            field * (dark ? 0.65 : 0.76) + highlight,
          );
          context.fillStyle = `rgb(${red} ${green} ${blue})`;
          context.beginPath();
          context.arc(x + dx, y + dy, 1.05 + waveMix * 0.55, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
      canvas!.dataset.ready = "true";
    }

    function animate(now: number) {
      frame = 0;
      if (!visible || document.hidden || lost || reduced.matches) return;
      if (now - previous >= 1000 / 30) {
        elapsed += previous ? Math.min(now - previous, 50) : 0;
        previous = now;
        smoothed.x += (pointer.x - smoothed.x) * 0.12;
        smoothed.y += (pointer.y - smoothed.y) * 0.12;
        draw(elapsed);
      }
      frame = requestAnimationFrame(animate);
    }

    function syncAnimation() {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (!visible || document.hidden || lost) return;
      draw(elapsed);
      if (!reduced.matches) frame = requestAnimationFrame(animate);
    }

    function resize() {
      const bounds = canvas!.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      scale = Math.min(
        window.devicePixelRatio || 1,
        1.5,
        2048 / Math.max(width, 1),
      );
      canvas!.width = Math.round(width * scale);
      canvas!.height = Math.round(height * scale);
      if (visible) draw(elapsed);
    }

    function move(event: PointerEvent) {
      if (event.pointerType === "touch" || reduced.matches) return;
      const bounds = canvas!.getBoundingClientRect();
      pointer = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      if (smoothed.x < 0) smoothed = { ...pointer };
    }

    function leave() {
      pointer = { x: -1000, y: -1000 };
    }

    function contextLost(event: Event) {
      event.preventDefault();
      lost = true;
      canvas!.dataset.ready = "false";
      cancelAnimationFrame(frame);
    }

    function contextRestored() {
      context = canvas!.getContext("2d", { alpha: true });
      lost = !context;
      resize();
      syncAnimation();
    }

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        syncAnimation();
      },
      { rootMargin: "60px" },
    );
    intersectionObserver.observe(host);
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", syncAnimation);
    reduced.addEventListener("change", syncAnimation);
    canvas.addEventListener("contextlost", contextLost);
    canvas.addEventListener("contextrestored", contextRestored);
    resize();

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", syncAnimation);
      reduced.removeEventListener("change", syncAnimation);
      canvas.removeEventListener("contextlost", contextLost);
      canvas.removeEventListener("contextrestored", contextRestored);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className={`lp-footer-dot-field ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
