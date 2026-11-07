// Cloud shader by Manu Arora / Aceternity UI, adapted for RMS.
// Source: https://ui.aceternity.com/registry/cloud-shader.json
// Aceternity License: https://ui.aceternity.com/licence
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./marketing-effects.css";

export type CloudShaderProps = {
  className?: string;
  children?: ReactNode;
  speed?: number;
  count?: number;
  cloudColor?: string;
  skyTopColor?: string;
  skyBottomColor?: string;
  /** Soft localized glow; zero keeps the sky evenly lit with no visible sun. */
  sunIntensity?: number;
};

const VERT = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// Original cloud shader for Aceternity UI.
// Each cloud is an asymmetric envelope (dome top, flat base) filled with
// domain-warped billow noise. A second density sample above the pixel
// approximates self-shadowing. Clouds drift horizontally and wrap around.
const FRAG = `
precision highp float;

varying vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform float u_count;
uniform vec3 u_cloud;
uniform vec3 u_skyTop;
uniform vec3 u_skyBottom;
uniform float u_sunIntensity;

const mat2 R = mat2(0.80, 0.60, -0.60, 0.80);

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(41.31, 289.17))) * 26737.367);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    sum += amp * vnoise(p);
    p = R * p * 2.03 + 19.19;
    amp *= 0.5;
  }
  return sum;
}

// billow noise: sharp puffy ridges, like cauliflower cloud tops
float billow(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 5; i++) {
    sum += amp * (1.0 - abs(2.0 * vnoise(p) - 1.0));
    p = R * p * 2.11 + 13.37;
    amp *= 0.5;
  }
  return sum;
}

// raw density for one cloud at point p
float cloudDensity(vec2 p, vec2 c, vec2 r, float seed, float t) {
  vec2 q = p - c;

  // envelope: dome above the center, flat base below
  float ry = q.y > 0.0 ? r.y : r.y * 0.42;
  float env = 1.0 - length(vec2(q.x / r.x, q.y / ry));
  if (env < -0.35) return 0.0;

  // domain-warped billow detail, moves with the cloud, evolves slowly
  vec2 dp = q * (2.4 / r.x) + seed;
  dp += 0.6 * vec2(
    fbm(dp * 1.4 + t * 0.04),
    fbm(dp * 1.4 + 7.7 - t * 0.03)
  );
  float detail = billow(dp * 1.6);

  return env + (detail - 0.62) * 0.62;
}

// shades one cloud and blends it over the current color
vec3 shadeCloud(vec3 color, vec3 sky, vec2 p, vec2 c, vec2 r, float seed, float t, float dist) {
  float d = cloudDensity(p, c, r, seed, t);
  if (d < 0.02) return color;

  // sample density toward the ambient sky for self-shadowing
  float dUp = cloudDensity(p + vec2(0.0, r.y * 0.55), c, r, seed, t);
  float occl = clamp((dUp - d) * 1.1 + d * 0.55, 0.0, 1.0);

  vec3 lit = u_cloud * 1.04;
  vec3 shadow = mix(u_cloud * 0.60, sky, 0.38);
  vec3 cloudCol = mix(lit, shadow, occl * 0.85);

  float alpha = smoothstep(0.02, 0.38, d);

  // silver lining on thin edges
  float rim = smoothstep(0.02, 0.14, d) * (1.0 - smoothstep(0.14, 0.40, d));
  cloudCol += rim * 0.10;

  // atmospheric perspective: far clouds fade into the sky
  cloudCol = mix(cloudCol, sky, dist * 0.35);
  alpha *= mix(1.0, 0.8, dist);

  return mix(color, cloudCol, alpha);
}

// one drifting cloud: horizontal wrap + gentle vertical bob
vec3 cloudPass(vec3 color, vec3 sky, vec2 p, float aspect, float t,
               float spd, float phase, float y, vec2 r, float seed, float dist) {
  float cx = mix(-r.x - 0.25, aspect + r.x + 0.25, fract(t * spd + phase));
  float cy = y + sin(t * 0.05 + phase * 6.2831) * 0.012;
  return shadeCloud(color, sky, p, vec2(cx, cy), r, seed, t, dist);
}

void main() {
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(v_uv.x * aspect, v_uv.y);
  float t = u_time;

  vec3 sky = mix(u_skyBottom, u_skyTop, v_uv.y);
  vec3 color = sky;

  // faint haze band near the horizon
  color = mix(color, u_skyBottom * 1.06, smoothstep(0.35, 0.0, v_uv.y) * 0.5);

  // Optional localized glow. RMS sets this to zero for a sun-free sky.
  vec2 sunPos = vec2(aspect * 0.78, 0.92);
  float sunDist = length(p - sunPos);
  color += vec3(1.0, 0.95, 0.82) * exp(-sunDist * sunDist * 5.0) * u_sunIntensity;

  // thin cirrus streaks, stretched horizontally, high in the sky
  float cirrusBand = smoothstep(0.55, 0.8, v_uv.y) * (1.0 - smoothstep(0.9, 1.0, v_uv.y));
  if (cirrusBand > 0.01) {
    float streak = fbm(vec2(p.x * 1.6 - t * 0.006, p.y * 12.0));
    float wisp = smoothstep(0.52, 0.78, streak) * cirrusBand;
    color = mix(color, u_cloud * 0.98, wisp * 0.35);
  }

  // far layer: small, high, slow
  if (u_count > 5.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.006, 0.10, 0.84, vec2(0.20, 0.10), 43.7, 1.0);
  }
  if (u_count > 4.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.008, 0.62, 0.73, vec2(0.24, 0.12), 71.3, 0.85);
  }

  // middle layer
  if (u_count > 3.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.011, 0.33, 0.60, vec2(0.34, 0.16), 17.3, 0.55);
  }
  if (u_count > 2.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.013, 0.80, 0.47, vec2(0.30, 0.15), 29.9, 0.45);
  }

  // near layer: big, low, fast
  if (u_count > 1.5) {
    color = cloudPass(color, sky, p, aspect, t, 0.016, 0.05, 0.35, vec2(0.46, 0.20), 91.1, 0.15);
  }
  color = cloudPass(color, sky, p, aspect, t, 0.020, 0.48, 0.20, vec2(0.56, 0.24), 57.2, 0.0);

  gl_FragColor = vec4(color, 1.0);
}
`;

function parseColor(color: string): [number, number, number] {
  const value = color.trim();
  const hex = value.replace(/^#/, "");
  if (/^#[\da-f]{3}$/i.test(value)) {
    return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16) / 255) as [
      number,
      number,
      number,
    ];
  }
  if (/^#[\da-f]{6}$/i.test(value)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
      number,
      number,
      number,
    ];
  }
  const rgb = value.match(/[\d.]+/g);
  if (value.startsWith("rgb") && rgb && rgb.length >= 3) {
    return rgb
      .slice(0, 3)
      .map((v) => Math.min(1, Math.max(0, Number(v) / 255))) as [
      number,
      number,
      number,
    ];
  }
  return [0.95, 0.97, 1];
}

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function CloudShader({
  className = "",
  children,
  speed = 0.25,
  count = 3,
  cloudColor = "#f8fbff",
  skyTopColor = "#72afea",
  skyBottomColor = "#d6eafe",
  sunIntensity = 0,
}: CloudShaderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paramsRef = useRef({
    speed,
    count,
    cloudColor,
    skyTopColor,
    skyBottomColor,
    sunIntensity,
  });
  const [ready, setReady] = useState(false);
  const [generation, setGeneration] = useState(0);
  paramsRef.current = {
    speed,
    count,
    cloudColor,
    skyTopColor,
    skyBottomColor,
    sunIntensity,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        premultipliedAlpha: false,
        powerPreference: "low-power",
      });
    } catch {
      return;
    }
    if (!gl) return;
    const ctx = gl;
    const vert = compile(ctx, ctx.VERTEX_SHADER, VERT);
    const frag = compile(ctx, ctx.FRAGMENT_SHADER, FRAG);
    if (!vert || !frag) {
      if (vert) ctx.deleteShader(vert);
      if (frag) ctx.deleteShader(frag);
      return;
    }
    const program = ctx.createProgram();
    if (!program) {
      ctx.deleteShader(vert);
      ctx.deleteShader(frag);
      return;
    }
    ctx.attachShader(program, vert);
    ctx.attachShader(program, frag);
    ctx.bindAttribLocation(program, 0, "a_pos");
    ctx.linkProgram(program);
    if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
      ctx.deleteProgram(program);
      ctx.deleteShader(vert);
      ctx.deleteShader(frag);
      return;
    }
    ctx.useProgram(program);
    const buffer = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
    ctx.bufferData(
      ctx.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      ctx.STATIC_DRAW,
    );
    ctx.enableVertexAttribArray(0);
    ctx.vertexAttribPointer(0, 2, ctx.FLOAT, false, 0, 0);
    const loc = {
      res: ctx.getUniformLocation(program, "u_res"),
      time: ctx.getUniformLocation(program, "u_time"),
      count: ctx.getUniformLocation(program, "u_count"),
      cloud: ctx.getUniformLocation(program, "u_cloud"),
      skyTop: ctx.getUniformLocation(program, "u_skyTop"),
      skyBottom: ctx.getUniformLocation(program, "u_skyBottom"),
      sunIntensity: ctx.getUniformLocation(program, "u_sunIntensity"),
    };
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let active = true,
      intersecting = false,
      lost = false,
      frame = 0,
      elapsed = 0,
      lastTime = 0;
    const draw = () => {
      if (!active || lost) return;
      const p = paramsRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      // Keep the decorative shader within a bounded pixel budget on large displays.
      const scale = Math.min(dpr, 1600 / Math.max(1, canvas.clientWidth));
      const w = Math.max(1, Math.floor(canvas.clientWidth * scale));
      const h = Math.max(1, Math.floor(canvas.clientHeight * scale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.viewport(0, 0, w, h);
      ctx.uniform2f(loc.res, w, h);
      ctx.uniform1f(loc.time, preference.matches ? 0 : elapsed);
      ctx.uniform1f(loc.count, Math.min(6, Math.max(1, p.count)));
      ctx.uniform1f(loc.sunIntensity, Math.min(1, Math.max(0, p.sunIntensity)));
      ctx.uniform3fv(loc.cloud, parseColor(p.cloudColor));
      ctx.uniform3fv(loc.skyTop, parseColor(p.skyTopColor));
      ctx.uniform3fv(loc.skyBottom, parseColor(p.skyBottomColor));
      ctx.drawArrays(ctx.TRIANGLES, 0, 3);
      setReady(true);
    };
    const tick = (now: number) => {
      if (
        !active ||
        lost ||
        !intersecting ||
        document.hidden ||
        preference.matches
      ) {
        frame = 0;
        return;
      }
      if (!lastTime || now - lastTime >= 1000 / 30) {
        if (lastTime)
          elapsed +=
            (Math.min(now - lastTime, 100) / 1000) *
            Math.max(0, paramsRef.current.speed);
        lastTime = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    };
    const resume = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (!active || lost || !intersecting || document.hidden) return;
      draw();
      if (!preference.matches && paramsRef.current.speed > 0)
        frame = requestAnimationFrame(tick);
    };
    const resize = new ResizeObserver(() => {
      if (intersecting && !document.hidden) draw();
    });
    resize.observe(canvas);
    const visible = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        resume();
      },
      { rootMargin: "80px" },
    );
    visible.observe(canvas);
    const contextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      cancelAnimationFrame(frame);
      setReady(false);
    };
    const contextRestored = () => {
      if (active) setGeneration((value) => value + 1);
    };
    canvas.addEventListener("webglcontextlost", contextLost);
    canvas.addEventListener("webglcontextrestored", contextRestored);
    document.addEventListener("visibilitychange", resume);
    preference.addEventListener("change", resume);
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      resize.disconnect();
      visible.disconnect();
      document.removeEventListener("visibilitychange", resume);
      preference.removeEventListener("change", resume);
      canvas.removeEventListener("webglcontextlost", contextLost);
      canvas.removeEventListener("webglcontextrestored", contextRestored);
      ctx.deleteBuffer(buffer);
      ctx.deleteProgram(program);
      ctx.deleteShader(vert);
      ctx.deleteShader(frag);
    };
  }, [generation]);

  return (
    <div
      className={`rms-cloud-shader ${className}`}
      style={
        {
          "--cloud-sky-top": skyTopColor,
          "--cloud-sky-bottom": skyBottomColor,
        } as CSSProperties
      }
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ opacity: ready ? 1 : 0 }}
      />
      {children ? <div className="rms-cloud-content">{children}</div> : null}
    </div>
  );
}
