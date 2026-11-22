import { useEffect, useId, useRef, useState } from "react";
import { FileText, FolderOpen, Image as ImageIcon, Mic, Plus } from "lucide-react";
import { t } from "@/lib/i18n";
import "./composer-goo-menu.css";

export interface ComposerGooMenuProps {
  disabled?: boolean;
  voiceActive?: boolean;
  onAttachFile: () => void;
  onAttachPhoto: () => void;
  onToggleVoice: () => void;
  onPickSource: () => void;
}

interface SpringState {
  x: number;
  v: number;
  t: number;
  k: number;
  c: number;
}

const makeSpring = (x: number, k = 400, c = 30): SpringState => ({
  x,
  v: 0,
  t: x,
  k,
  c,
});

const tuneSpring = (
  s: SpringState,
  k: number,
  c: number,
  reduce: boolean,
) => {
  s.k = k;
  s.c = reduce ? 2 * Math.sqrt(k) : c;
};

const stepSpring = (s: SpringState, dt: number) => {
  const a = -s.k * (s.x - s.t) - s.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
};

const clamp = (v: number, a: number, b: number) =>
  Math.max(a, Math.min(b, v));

// + 버튼이 왼쪽 아래에 놓이므로 위~오른쪽 부채꼴(-92° ~ -8°)로 펼쳐 312px 패널 안에서도 잘리지 않게 합니다.
const ANGLES_DEG = [-92, -64, -36, -8];
const RADIUS = 82;
const MAIN_SIZE = 32;
const BUBBLE_SIZE = 38;
// 레이어 좌표계 기준 원점(+ 버튼 중심)
const ORIGIN_X = 32;
const ORIGIN_Y = 128;

/**
 * 연구 도우미 입력창 `+` Goo Menu.
 * Motion Studies Goo Menu의 스프링 물리 + SVG goo 필터를 Montage 토큰과 React로 옮겼습니다.
 * 4개 버블: 파일 · 사진 · 음성 · 자료 붙이기
 */
export function ComposerGooMenu({
  disabled = false,
  voiceActive = false,
  onAttachFile,
  onAttachPhoto,
  onToggleVoice,
  onPickSource,
}: ComposerGooMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const mainBlobRef = useRef<HTMLDivElement>(null);
  const plusRef = useRef<HTMLSpanElement>(null);
  const blobRefs = useRef<(HTMLDivElement | null)[]>([]);
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const filterId = useId().replace(/:/g, "");

  const actions = [
    {
      id: "file",
      label: t("파일"),
      ariaLabel: t("파일 첨부"),
      icon: <FileText aria-hidden="true" className="size-4" />,
      onClick: onAttachFile,
    },
    {
      id: "photo",
      label: t("사진"),
      ariaLabel: t("사진 첨부"),
      icon: <ImageIcon aria-hidden="true" className="size-4" />,
      onClick: onAttachPhoto,
    },
    {
      id: "voice",
      label: t("음성"),
      ariaLabel: t("음성으로 질문 입력"),
      icon: <Mic aria-hidden="true" className="size-4" />,
      active: voiceActive,
      onClick: onToggleVoice,
    },
    {
      id: "source",
      label: t("자료 붙이기"),
      ariaLabel: t("이 연구의 기록·자료 붙이기"),
      icon: <FolderOpen aria-hidden="true" className="size-4" />,
      onClick: onPickSource,
    },
  ];

  // 스프링 상태는 ref에 두고 rAF 한 루프로 DOM transform만 갱신합니다.
  const simRef = useRef<{
    open: boolean;
    mainRot: SpringState;
    mainScale: SpringState;
    bubs: {
      x: SpringState;
      y: SpringState;
      s: SpringState;
      delay: number;
      target: { x: number; y: number };
      k: number;
      c: number;
    }[];
  } | null>(null);

  if (!simRef.current) {
    simRef.current = {
      open: false,
      mainRot: makeSpring(0, 320, 22),
      mainScale: makeSpring(1, 520, 18),
      bubs: ANGLES_DEG.map(() => ({
        x: makeSpring(0, 260, 17),
        y: makeSpring(0, 260, 17),
        s: makeSpring(0.5, 380, 22),
        delay: 0,
        target: { x: 0, y: 0 },
        k: 260,
        c: 17,
      })),
    };
  }

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const sim = simRef.current!;
    sim.open = open;
    tuneSpring(sim.mainRot, 320, 22, reduce);
    sim.mainRot.t = open ? 45 : 0;
    sim.mainScale.v -= open ? 2.4 : 1.2;

    const homes = ANGLES_DEG.map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return { x: Math.cos(rad) * RADIUS, y: Math.sin(rad) * RADIUS };
    });

    sim.bubs.forEach((b, i) => {
      if (open) {
        b.delay = reduce ? 0 : i * 0.036;
        b.target = homes[i];
        b.k = 240;
        b.c = 16;
        tuneSpring(b.s, 320, 16, reduce);
        b.s.t = 1;
      } else {
        b.delay = reduce ? 0 : (sim.bubs.length - 1 - i) * 0.024;
        b.target = { x: 0, y: 0 };
        b.k = 480;
        b.c = 32;
        tuneSpring(b.s, 420, 30, reduce);
        b.s.t = 0.5;
      }
    });
  }, [open]);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const sim = simRef.current!;
      const sub = 4;

      for (let step = 0; step < sub; step++) {
        const sdt = dt / sub;
        stepSpring(sim.mainRot, sdt);
        stepSpring(sim.mainScale, sdt);
        for (const b of sim.bubs) {
          if (b.delay > 0) {
            b.delay -= sdt;
          } else {
            tuneSpring(b.x, b.k, b.c, reduce);
            tuneSpring(b.y, b.k, b.c, reduce);
            b.x.t = b.target.x;
            b.y.t = b.target.y;
          }
          stepSpring(b.x, sdt);
          stepSpring(b.y, sdt);
          stepSpring(b.s, sdt);
        }
      }

      if (mainBlobRef.current) {
        const s = sim.mainScale.x;
        mainBlobRef.current.style.transform = `translate(${ORIGIN_X - MAIN_SIZE / 2}px, ${ORIGIN_Y - MAIN_SIZE / 2}px) scale(${s})`;
      }
      if (plusRef.current) {
        plusRef.current.style.transform = `rotate(${sim.mainRot.x}deg)`;
      }

      sim.bubs.forEach((b, i) => {
        const x = ORIGIN_X + b.x.x - BUBBLE_SIZE / 2;
        const y = ORIGIN_Y + b.y.x - BUBBLE_SIZE / 2;
        const sc = b.s.x;
        const speed = Math.hypot(b.x.v, b.y.v);
        const stretch = reduce ? 1 : 1 + Math.min(speed / 2400, 0.28);
        const angle = Math.atan2(b.y.v, b.x.v);
        const blob = blobRefs.current[i];
        const btn = btnRefs.current[i];
        if (blob) {
          blob.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad) scale(${sc * stretch}, ${sc / stretch})`;
          blob.style.opacity = String(
            clamp((Math.hypot(b.x.x, b.y.x) - 4) / 18, 0, 1),
          );
        }
        if (btn) {
          btn.style.transform = `translate(${x}px, ${y}px) scale(${sc})`;
          btn.style.opacity = String(
            clamp((Math.hypot(b.x.x, b.y.x) - 12) / 30, 0, 1),
          );
          btn.style.pointerEvents = sim.open ? "auto" : "none";
        }
      });

      // 정지 상태에 가까우면 불필요한 CPU 사용을 줄이도록 닫힌 뒤 안정화되면 멈춥니다.
      const settled =
        !sim.open &&
        Math.abs(sim.mainRot.x) < 0.2 &&
        Math.abs(sim.mainRot.v) < 0.2 &&
        sim.bubs.every(
          (b) =>
            Math.hypot(b.x.x, b.y.x) < 0.4 && Math.hypot(b.x.v, b.y.v) < 0.4,
        );
      if (!settled) {
        raf = requestAnimationFrame(loop);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="composer-goo-root" data-open={open || undefined}>
      <svg
        width="0"
        height="0"
        className="composer-goo-svg"
        aria-hidden="true"
      >
        <filter
          id={`composer-goo-${filterId}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation="7" result="blur" />
          <feColorMatrix
            in="blur"
            mode="matrix"
            values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 20 -9"
            result="goo"
          />
          <feComposite in="SourceGraphic" in2="goo" operator="atop" />
        </filter>
      </svg>

      {/* 액체 융합 레이어 */}
      <div
        className="composer-goo-stage composer-goo-layer"
        style={{ filter: `url(#composer-goo-${filterId})` }}
        aria-hidden="true"
      >
        <div ref={mainBlobRef} className="composer-goo-blob is-main" />
        {actions.map((action, i) => (
          <div
            key={action.id}
            ref={(el) => {
              blobRefs.current[i] = el;
            }}
            className="composer-goo-blob is-bubble"
          />
        ))}
      </div>

      {/* 실제 인터랙션 레이어 */}
      <div className="composer-goo-stage composer-goo-ui">
        {actions.map((action, i) => (
          <button
            key={action.id}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            className={`composer-goo-bubble${action.active ? " is-active" : ""}`}
            aria-label={action.ariaLabel}
            tabIndex={open ? 0 : -1}
            disabled={disabled}
            onClick={() => {
              setOpen(false);
              action.onClick();
            }}
          >
            {action.icon}
            <span className="composer-goo-tip">{action.label}</span>
          </button>
        ))}
      </div>

      {/* 메인 + 트리거 버튼 */}
      <button
        type="button"
        className="composer-goo-trigger"
        disabled={disabled}
        aria-label={open ? t("첨부 메뉴 닫기") : t("첨부 및 입력 도구 열기")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span ref={plusRef} className="composer-goo-plus">
          <Plus aria-hidden="true" className="size-4" />
        </span>
      </button>
    </div>
  );
}
