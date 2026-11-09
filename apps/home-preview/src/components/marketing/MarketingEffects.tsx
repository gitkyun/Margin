import { AssistantMascot } from "@/components/brand/Brand";
import { useRef, type ReactNode } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { VersionCompareSlider } from "@/components/VersionCompareSlider";
import { Icon } from "@/components/icons";
import "./marketing-effects.css";

/** RMS illustration; merging paths borrow the connector idiom of Aceternity animated beams. */
export function MergeFlow({ className = "" }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "80px" });
  const reduced = useReducedMotion();
  const paths = [
    "M75 56 V78 Q75 96 100 96 H180 Q210 96 210 125",
    "M210 56 V125",
    "M345 56 V78 Q345 96 320 96 H240 Q210 96 210 125",
  ];
  return (
    <div
      ref={ref}
      className={`rms-merge-flow ${className}`}
      aria-label="미팅 메모, 피드백, 연구 자료 중 선택한 기록을 연구 도우미가 읽고 제안하는 예시"
    >
      <div className="rms-merge-sources">
        {[
          ["edit", "미팅 메모"],
          ["feedback", "피드백"],
          ["file", "연구 자료"],
        ].map(([icon, label]) => (
          <span key={label}>
            <Icon name={icon} size={17} />
            {label}
          </span>
        ))}
      </div>
      <svg
        className="rms-merge-paths"
        viewBox="0 0 420 170"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {paths.map((path, i) => (
          <g key={path}>
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            {visible && !reduced && (
              <motion.path
                d={path}
                fill="none"
                stroke="#3685ff"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="13 220"
                initial={{ strokeDashoffset: 230 }}
                animate={{ strokeDashoffset: -230 }}
                transition={{
                  duration: 3,
                  delay: i * 0.35,
                  repeat: Infinity,
                  repeatDelay: 0.7,
                  ease: "linear",
                }}
              />
            )}
          </g>
        ))}
      </svg>
      <div className="rms-merge-result">
        <AssistantGlyph />
        <div>
          <strong>연구 도우미</strong>
          <span>선택한 기록만 읽어요</span>
        </div>
        <Icon name="arrow-right" size={18} />
      </div>
      <div className="rms-merge-suggestions">
        <span>
          <Icon name="check" size={13} />
          피드백 정리
        </span>
        <span>
          <Icon name="layers" size={13} />
          수정 방법
        </span>
        <span>
          <Icon name="tasks" size={13} />할 일 제안
        </span>
      </div>
    </div>
  );
}

export function AssistantGlyph({ className = "" }: { className?: string }) {
  return <AssistantMascot state="ready" size={44} className={className} />;
}

/** Adaptation of Aceternity's radial spotlight interaction, using the existing Motion runtime. */
export function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const x = useMotionValue(0),
    y = useMotionValue(0);
  const background = useMotionTemplate`radial-gradient(380px circle at ${x}px ${y}px, rgba(83,143,255,.16), transparent 78%)`;
  return (
    <motion.div
      className={`rms-spotlight-card ${className}`}
      onPointerMove={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        x.set(event.clientX - box.left);
        y.set(event.clientY - box.top);
      }}
    >
      <motion.div
        className="rms-spotlight-light"
        style={{ background }}
        aria-hidden="true"
      />
      <div className="rms-spotlight-content">{children}</div>
    </motion.div>
  );
}

/** 소개 페이지 글쓰기 카드의 버전 비교. 글쓰기 화면과 같은 VersionCompareSlider를 씁니다. */
export function ComparePreview({
  before = "선행연구를 조금 더 보완하면 좋겠습니다. 비교 기준을 명확히 하고, 다음 미팅에 설명해 주세요.",
  after = "비교 기준을 연구 목적 · 자료 수집 방식 · 분석 관점으로 나눕니다.\n선행연구 5편을 같은 기준으로 비교합니다.\n선택한 기준과 이유를 다음 미팅에서 설명합니다.",
  className = "",
}: {
  before?: string;
  after?: string;
  className?: string;
}) {
  return (
    <div className={`rms-compare-preview ${className}`}>
      <VersionCompareSlider
        className="rms-compare-stage"
        defaultPosition={48}
        before={
          <div className="rms-compare-sheet rms-compare-before">
            <span>이전 버전</span>
            <h4>핵심만 적었던 문장</h4>
            <p>{before}</p>
            <span className="rms-compare-pencil">
              <Icon name="edit" size={20} />
            </span>
          </div>
        }
        after={
          <div className="rms-compare-sheet rms-compare-after">
            <span>수정 버전</span>
            <h4>비교 기준을 구체적으로</h4>
            <ol>
              {after.split("\n").map((line, i) => (
                <li key={`${i}-${line}`}>{line}</li>
              ))}
            </ol>
          </div>
        }
      />
      <p className="rms-compare-hint">
        가운데 화살표를 좌우로 움직여 비교하세요.
      </p>
    </div>
  );
}
