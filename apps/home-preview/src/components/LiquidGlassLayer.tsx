import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/lib/theme";
import type { LiquidGlass } from "@ybouane/liquidglass";

/** Shader-only material. Real text, controls and research content stay outside its capture root. */
export function LiquidGlassLayer({ radius = 24 }: { radius?: number }) {
  const root = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLCanvasElement>(null);
  const lens = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [foreground, setForeground] = useState(!document.hidden);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    const visibility = () => setForeground(!document.hidden);
    update();
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (root.current) observer.observe(root.current);
    return () => {
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = root.current,
      canvas = backdrop.current,
      glass = lens.current;
    if (!el || !canvas || !glass || !visible || !foreground || reduced) return;
    let canceled = false;
    let instance: LiquidGlass | undefined;
    delete el.dataset.ready;
    function paint() {
      if (!el || !canvas) return;
      const { width, height } = el.getBoundingClientRect();
      if (!width || !height) return;
      const scale = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.scale(scale, scale);
      const dark = resolvedTheme === "dark";
      context.fillStyle = dark ? "#20252e" : "#f5f7fc";
      context.fillRect(0, 0, width, height);
      const daylight = context.createLinearGradient(0, 0, width, height);
      daylight.addColorStop(0, dark ? "#404b5f66" : "#ffffffee");
      daylight.addColorStop(0.45, dark ? "#1b202800" : "#ffffff66");
      daylight.addColorStop(1, dark ? "#38486344" : "#cad9f566");
      context.fillStyle = daylight;
      context.fillRect(0, 0, width, height);
      // A restrained rim is sampled by the optical shader, rather than blurring the live text.
      context.strokeStyle = dark ? "#b5c4e02b" : "#ffffffcc";
      context.lineWidth = 1;
      context.strokeRect(1, 1, width - 2, height - 2);
      instance?.markChanged(canvas);
    }
    paint();
    const resize = new ResizeObserver(paint);
    resize.observe(el);
    void (async () => {
      try {
        const { LiquidGlass: Engine } = await import("@ybouane/liquidglass");
        await document.fonts.ready;
        if (canceled) return;
        const created = await Engine.init({
          root: el,
          glassElements: [glass],
          defaults: {
            cornerRadius: radius,
            zRadius: 9,
            blurAmount: 0.16,
            refraction: 0.22,
            chromAberration: 0.008,
            edgeHighlight: 0.16,
            specular: 0.12,
            fresnel: 0.28,
            distortion: 0,
            tintStrength: 0.025,
            brightness: resolvedTheme === "dark" ? -0.02 : 0.025,
            shadowOpacity: 0,
            floating: false,
            button: false,
          },
        });
        if (canceled) {
          created.destroy();
          return;
        }
        instance = created;
        for (const output of created.glassCanvases.values())
          output.setAttribute("aria-hidden", "true");
        el.dataset.ready = "true";
      } catch {
        // CSS frosted material remains available without WebGL or on a failed capture.
        delete el.dataset.ready;
      }
    })();
    return () => {
      canceled = true;
      resize.disconnect();
      instance?.destroy();
      delete el.dataset.ready;
    };
  }, [resolvedTheme, visible, foreground, reduced, radius]);

  return (
    <div ref={root} className="rms-liquid-layer" aria-hidden="true">
      <canvas ref={backdrop} className="rms-liquid-scene" />
      <div ref={lens} className="rms-liquid-lens" />
    </div>
  );
}
