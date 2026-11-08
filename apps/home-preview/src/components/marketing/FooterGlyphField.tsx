import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";

/**
 * Footer ground drawn as a glyph grid: a brand-blue field of cells, a ragged
 * dissolve into the page above, and the Margin mascot rendered from its own
 * artwork as white cells textured with dots, squares and crosses.
 *
 * Decorative only (aria-hidden, pointer-events: none). The footer stays the
 * pointer target so its links keep working; the field reads pointer moves from
 * the host. With reduced motion it draws one still frame.
 */

const MASCOT_SRC = "/brand/mascot/01_idle.png";
// The cloud's box inside the 1024px artwork, and its eyes, in artwork pixels.
const CROP = { x: 130, y: 210, w: 760, h: 670 };
const EYES = [
  { x: 535, y: 485, rx: 58, ry: 80 },
  { x: 680, y: 452, rx: 53, ry: 75 },
];
const DISSOLVE = 96; // px of field above the footer's top edge (canvas inset)

type Palette = {
  ground: string;
  grid: string;
  shape: string;
  markOnShape: string;
  markOnGround: string;
};

const PALETTES: Record<"light" | "dark", Palette> = {
  light: {
    ground: "#1a4be8",
    grid: "rgba(255, 255, 255, 0.13)",
    shape: "#f3f6ff",
    markOnShape: "#3d63e4",
    markOnGround: "rgba(236, 242, 255, 0.62)",
  },
  dark: {
    ground: "#102c86",
    grid: "rgba(255, 255, 255, 0.08)",
    shape: "#cad8ff",
    markOnShape: "#2b4cb4",
    markOnGround: "rgba(200, 216, 255, 0.5)",
  },
};

function hash(a: number, b: number, seed = 0) {
  let x =
    Math.imul(a, 374761393) +
    Math.imul(b, 668265263) +
    Math.imul(seed, 1442695041);
  // murmur3 finalizer: neighbouring cells must not correlate, or the
  // dissolve reads as stripes.
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967295;
}

type Mark = "none" | "dot" | "square" | "cross" | "grain";

/** Tone 0..1 (1 = white) to the glyph drawn on a shape cell. */
function markForTone(tone: number): Mark {
  if (tone >= 0.86) return "none";
  if (tone >= 0.72) return "dot";
  if (tone >= 0.58) return "square";
  if (tone >= 0.45) return "cross";
  return "grain";
}

function drawMark(
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  if (mark === "none") return;
  const c = size / 2;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  if (mark === "dot") {
    ctx.fillRect(x + c - 1, y + c - 1, 2, 2);
  } else if (mark === "square") {
    const s = Math.round(size * 0.52);
    const o = Math.round((size - s) / 2) + 0.5;
    ctx.strokeRect(x + o, y + o, s - 1, s - 1);
  } else if (mark === "cross") {
    const p = size * 0.24;
    ctx.beginPath();
    ctx.moveTo(x + p, y + p);
    ctx.lineTo(x + size - p, y + size - p);
    ctx.moveTo(x + size - p, y + p);
    ctx.lineTo(x + p, y + size - p);
    ctx.stroke();
  } else {
    const q = size / 4;
    for (const [gx, gy] of [
      [1, 1],
      [3, 1],
      [1, 3],
      [3, 3],
    ]) {
      ctx.fillRect(x + gx * q - 0.75, y + gy * q - 0.75, 1.5, 1.5);
    }
  }
}

export function FooterGlyphField({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;
    if (!canvas || !host) return;
    let ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const palette = PALETTES[resolvedTheme === "dark" ? "dark" : "light"];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const base = document.createElement("canvas");
    let baseCtx = base.getContext("2d");

    let width = 0;
    let height = 0;
    let scale = 1;
    let cell = 10;
    let cols = 0;
    let rows = 0;
    let frame = 0;
    let previous = 0;
    let elapsed = 0;
    let visible = false;
    let lost = false;
    let pointer = { x: -1e4, y: -1e4 };
    let smoothed = { x: -1e4, y: -1e4 };
    // Mascot placement in canvas px, and its tones sampled per cell.
    let mascot = { x: 0, y: 0, w: 0, h: 0 };
    let tones: Float32Array | null = null;
    let toneCols = 0;
    let toneRows = 0;
    let artwork: HTMLImageElement | null = null;

    function inEye(sx: number, sy: number, ox = 0, oy = 0, squash = 1) {
      return EYES.some((eye) => {
        const dx = (sx - eye.x - ox) / eye.rx;
        const dy = (sy - eye.y - oy) / (eye.ry * squash);
        return dx * dx + dy * dy <= 1;
      });
    }

    /** Artwork px of a cell's centre, or null when outside the mascot box. */
    function artworkPoint(col: number, row: number) {
      const cx = col * cell + cell / 2 - mascot.x;
      const cy = row * cell + cell / 2 - mascot.y;
      if (cx < 0 || cy < 0 || cx >= mascot.w || cy >= mascot.h) return null;
      return {
        sx: CROP.x + (cx / mascot.w) * CROP.w,
        sy: CROP.y + (cy / mascot.h) * CROP.h,
      };
    }

    /** Read the artwork once at quarter size: tone = darkest channel, so the
     *  saturated blue backdrop reads 0 and the white cloud reads near 1. */
    function sampleArtwork() {
      if (tones || !artwork) return;
      toneCols = Math.round(CROP.w / 4);
      toneRows = Math.round(CROP.h / 4);
      const sample = document.createElement("canvas");
      sample.width = toneCols;
      sample.height = toneRows;
      const sctx = sample.getContext("2d", { willReadFrequently: true });
      if (!sctx) return;
      sctx.drawImage(
        artwork,
        CROP.x,
        CROP.y,
        CROP.w,
        CROP.h,
        0,
        0,
        toneCols,
        toneRows,
      );
      const data = sctx.getImageData(0, 0, toneCols, toneRows).data;
      const count = toneCols * toneRows;
      const next = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        next[i] = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]) / 255;
      }
      // The cloud's body is blue too, so brightness alone can't separate it
      // from the backdrop. Flood the backdrop in from the edges, stopping at
      // the cloud's white rim; whatever the flood never reaches is the cloud.
      const outside = new Uint8Array(count);
      const stack: number[] = [];
      const seed = (i: number) => {
        if (!outside[i] && next[i] < 0.6) {
          outside[i] = 1;
          stack.push(i);
        }
      };
      for (let c = 0; c < toneCols; c++) {
        seed(c);
        seed((toneRows - 1) * toneCols + c);
      }
      for (let r = 0; r < toneRows; r++) {
        seed(r * toneCols);
        seed(r * toneCols + toneCols - 1);
      }
      while (stack.length) {
        const i = stack.pop()!;
        const c = i % toneCols;
        if (c > 0) seed(i - 1);
        if (c < toneCols - 1) seed(i + 1);
        if (i >= toneCols) seed(i - toneCols);
        if (i < count - toneCols) seed(i + toneCols);
      }
      for (let i = 0; i < count; i++) {
        // -1 marks the backdrop; inside, lift the blue body into the
        // textured range so it reads as cloud, not as a hole.
        next[i] = outside[i] ? -1 : Math.min(1, 0.32 + next[i] * 0.72);
      }
      tones = next;
    }

    function toneAt(col: number, row: number) {
      if (!tones) return -1;
      const p = artworkPoint(col, row);
      if (!p) return -1;
      const tc = Math.floor(((p.sx - CROP.x) / CROP.w) * toneCols);
      const tr = Math.floor(((p.sy - CROP.y) / CROP.h) * toneRows);
      if (tc < 0 || tr < 0 || tc >= toneCols || tr >= toneRows) return -1;
      return tones[tr * toneCols + tc];
    }

    /** The cell belongs to the mascot body (eyes are drawn per frame). */
    function shapeTone(col: number, row: number) {
      const tone = toneAt(col, row);
      if (tone < 0) return -1;
      const jitter = (hash(col, row, 7) - 0.5) * 0.08;
      const p = artworkPoint(col, row);
      // Eyes become body texture on the base layer; they are drawn on top.
      if (p && inEye(p.sx, p.sy)) return 0.6;
      return Math.min(1, tone + jitter);
    }

    function isGround(row: number) {
      const y = row * cell;
      if (y >= DISSOLVE) return 1;
      return y / DISSOLVE;
    }

    function drawBase() {
      if (!baseCtx) return;
      base.width = canvas!.width;
      base.height = canvas!.height;
      baseCtx.setTransform(scale, 0, 0, scale, 0, 0);
      baseCtx.clearRect(0, 0, width, height);
      // Solid ground below the dissolve band, with grid lines.
      baseCtx.fillStyle = palette.ground;
      baseCtx.fillRect(0, DISSOLVE, width, height - DISSOLVE);
      baseCtx.fillStyle = palette.grid;
      for (let x = 0; x <= width; x += cell)
        baseCtx.fillRect(x, DISSOLVE, 1, height - DISSOLVE);
      for (let y = DISSOLVE; y <= height; y += cell)
        baseCtx.fillRect(0, y, width, 1);
      // Dissolve: ground cells thin out toward the page above.
      for (let row = 0; row * cell < DISSOLVE; row++) {
        const p = isGround(row);
        for (let col = 0; col < cols; col++) {
          const x = col * cell;
          const y = row * cell;
          const roll = hash(col, row, 1);
          if (roll < Math.pow(p, 1.35)) {
            baseCtx.fillStyle = palette.ground;
            baseCtx.fillRect(x, y, cell, cell);
            baseCtx.fillStyle = palette.grid;
            baseCtx.fillRect(x, y, cell, 1);
            baseCtx.fillRect(x, y, 1, cell);
          } else if (hash(col, row, 2) < p * (1 - p) * 0.9) {
            const mark: Mark = hash(col, row, 4) > 0.5 ? "square" : "cross";
            drawMark(baseCtx, mark, x, y, cell, palette.ground);
          }
        }
      }
      // Mascot body.
      if (tones) {
        const c0 = Math.max(0, Math.floor(mascot.x / cell));
        const r0 = Math.max(0, Math.floor(mascot.y / cell));
        const c1 = Math.min(cols, Math.ceil((mascot.x + mascot.w) / cell));
        const r1 = Math.min(rows, Math.ceil((mascot.y + mascot.h) / cell));
        for (let row = r0; row < r1; row++) {
          for (let col = c0; col < c1; col++) {
            const tone = shapeTone(col, row);
            if (tone < 0) continue;
            const x = col * cell;
            const y = row * cell;
            baseCtx.fillStyle = palette.shape;
            baseCtx.fillRect(x, y, cell, cell);
            drawMark(
              baseCtx,
              markForTone(tone),
              x,
              y,
              cell,
              palette.markOnShape,
            );
          }
        }
      }
      canvas!.dataset.ready = "true";
    }

    function drawEyes(time: number) {
      if (!ctx || !tones) return;
      // Look toward the pointer by up to ~1.5 cells, in artwork pixels.
      let ox = 0;
      let oy = 0;
      if (!reduced.matches && smoothed.x > -1e3) {
        const cx = mascot.x + mascot.w * 0.55;
        const cy = mascot.y + mascot.h * 0.42;
        const dx = smoothed.x - cx;
        const dy = smoothed.y - cy;
        const d = Math.hypot(dx, dy) || 1;
        const reach = Math.min(1, d / 260);
        const px = (cell * 1.5 * CROP.w) / mascot.w;
        ox = (dx / d) * reach * px;
        oy = (dy / d) * reach * px;
      }
      // A blink every ~5s, 140ms long.
      const cycle = time % 5200;
      const blink = !reduced.matches && cycle > 5060 ? 0.16 : 1;
      const c0 = Math.max(0, Math.floor(mascot.x / cell));
      const r0 = Math.max(0, Math.floor(mascot.y / cell));
      const c1 = Math.min(cols, Math.ceil((mascot.x + mascot.w) / cell));
      const r1 = Math.min(rows, Math.ceil((mascot.y + mascot.h) / cell));
      ctx.fillStyle = palette.ground; // eyes read as holes in the white cloud
      for (let row = r0; row < r1; row++) {
        for (let col = c0; col < c1; col++) {
          const p = artworkPoint(col, row);
          if (!p || !inEye(p.sx, p.sy, ox, oy, blink)) continue;
          ctx.fillRect(col * cell, row * cell, cell, cell);
        }
      }
    }

    function drawLive(time: number) {
      if (!ctx) return;
      const motion = !reduced.matches;
      // Idle flicker: a few cells change glyph for ~0.7s at a time.
      if (motion) {
        const tick = Math.floor(time / 700);
        for (let row = Math.ceil(DISSOLVE / cell); row < rows; row++) {
          for (let col = 0; col < cols; col++) {
            if (hash(col, row, tick) > 0.0035) continue;
            const tone = shapeTone(col, row);
            const onShape = tone >= 0;
            const mark: Mark = onShape
              ? markForTone(Math.max(0.45, tone - 0.2))
              : hash(col, row, tick + 9) > 0.5
                ? "square"
                : "dot";
            drawMark(
              ctx,
              mark,
              col * cell,
              row * cell,
              cell,
              onShape ? palette.markOnShape : palette.markOnGround,
            );
          }
        }
      }
      // Pointer: rings of glyphs travel outward from the cursor.
      if (motion && smoothed.x > -1e3) {
        const radius = cell * 11;
        const c0 = Math.max(0, Math.floor((smoothed.x - radius) / cell));
        const c1 = Math.min(cols, Math.ceil((smoothed.x + radius) / cell));
        const r0 = Math.max(
          Math.ceil(DISSOLVE / cell),
          Math.floor((smoothed.y - radius) / cell),
        );
        const r1 = Math.min(rows, Math.ceil((smoothed.y + radius) / cell));
        for (let row = r0; row < r1; row++) {
          for (let col = c0; col < c1; col++) {
            const dx = col * cell + cell / 2 - smoothed.x;
            const dy = row * cell + cell / 2 - smoothed.y;
            const d = Math.hypot(dx, dy);
            if (d > radius) continue;
            const ring = (d / cell - time / 90) % 4;
            const band = ring < 0 ? ring + 4 : ring;
            const marks: Mark[] = ["square", "cross", "dot", "none"];
            const mark = marks[Math.floor(band)];
            if (mark === "none" || hash(col, row, 11) > 1 - d / radius + 0.25)
              continue;
            const onShape = shapeTone(col, row) >= 0;
            drawMark(
              ctx,
              mark,
              col * cell,
              row * cell,
              cell,
              onShape ? palette.markOnShape : palette.markOnGround,
            );
          }
        }
      }
    }

    function draw(time: number) {
      if (!ctx || !width || !height || lost) return;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas!.width, canvas!.height);
      ctx.drawImage(base, 0, 0);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      drawEyes(time);
      drawLive(time);
    }

    function layout() {
      const bounds = canvas!.getBoundingClientRect();
      width = bounds.width;
      height = bounds.height;
      scale = Math.min(
        window.devicePixelRatio || 1,
        2,
        4096 / Math.max(width, 1),
      );
      canvas!.width = Math.round(width * scale);
      canvas!.height = Math.round(height * scale);
      cell = width < 600 ? 8 : 10;
      cols = Math.ceil(width / cell);
      rows = Math.ceil(height / cell);
      // The mascot rises from the band under the card and runs off the bottom.
      const inner = host!.querySelector<HTMLElement>(".lp-footer-inner");
      const cardBottom = inner
        ? inner.getBoundingClientRect().bottom - bounds.top
        : height * 0.6;
      const narrow = width < 600;
      const w = narrow
        ? Math.min(width * 0.86, 420)
        : Math.min(Math.max(width * 0.32, 360), 520);
      const h = (w * CROP.h) / CROP.w;
      const centre = narrow ? width * 0.5 : width * 0.7;
      mascot = {
        x: Math.round((centre - w / 2) / cell) * cell,
        y: Math.round((cardBottom + (narrow ? 20 : 28)) / cell) * cell,
        w,
        h,
      };
      sampleArtwork();
      drawBase();
      if (visible) draw(elapsed);
    }

    function animate(now: number) {
      frame = 0;
      if (!visible || document.hidden || lost || reduced.matches) return;
      if (now - previous >= 1000 / 30) {
        elapsed += previous ? Math.min(now - previous, 50) : 0;
        previous = now;
        if (pointer.x > -1e3) {
          smoothed.x += (pointer.x - smoothed.x) * 0.18;
          smoothed.y += (pointer.y - smoothed.y) * 0.18;
        } else {
          smoothed = { ...pointer };
        }
        draw(elapsed);
      }
      frame = requestAnimationFrame(animate);
    }

    function sync() {
      cancelAnimationFrame(frame);
      frame = 0;
      previous = 0;
      if (!visible || document.hidden || lost) return;
      draw(elapsed);
      if (!reduced.matches) frame = requestAnimationFrame(animate);
    }

    function move(event: PointerEvent) {
      if (event.pointerType === "touch" || reduced.matches) return;
      const bounds = canvas!.getBoundingClientRect();
      pointer = {
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      };
      if (smoothed.x < -1e3) smoothed = { ...pointer };
    }

    function leave() {
      pointer = { x: -1e4, y: -1e4 };
    }

    function contextLost(event: Event) {
      event.preventDefault();
      lost = true;
      canvas!.dataset.ready = "false";
      cancelAnimationFrame(frame);
    }

    function contextRestored() {
      ctx = canvas!.getContext("2d", { alpha: true });
      baseCtx = base.getContext("2d");
      lost = !ctx;
      layout();
      sync();
    }

    let disposed = false;
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      if (disposed) return;
      artwork = image;
      layout();
    };
    image.src = MASCOT_SRC;

    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(host);
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { rootMargin: "80px" },
    );
    intersectionObserver.observe(host);
    host.addEventListener("pointermove", move, { passive: true });
    host.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", sync);
    reduced.addEventListener("change", sync);
    canvas.addEventListener("contextlost", contextLost);
    canvas.addEventListener("contextrestored", contextRestored);
    layout();

    return () => {
      disposed = true;
      image.onload = null;
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", sync);
      reduced.removeEventListener("change", sync);
      canvas.removeEventListener("contextlost", contextLost);
      canvas.removeEventListener("contextrestored", contextRestored);
    };
  }, [resolvedTheme]);

  return (
    <canvas
      ref={canvasRef}
      className={`lp-footer-glyph-field ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
