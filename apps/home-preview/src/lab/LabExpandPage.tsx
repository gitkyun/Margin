/**
 * 시안: 온보딩 마지막에 미리보기 창이 실제 연구 홈으로 커지는 전환.
 * 박자 길이·곡선·작은 화면 크기를 직접 바꿔 가며 볼 수 있습니다. 제품 문구가 아닙니다.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { HomePreview } from "@/components/onboarding/HomePreview";
import { Button } from "@/components/ui/button";
import {
  EXPAND_TIMING,
  canExpand,
  expandIntoHome,
  type ExpandTiming,
} from "@/lib/expand-home";
import { useWorkspace } from "@/lib/workspace";
import "@/pages/onboarding.css";
import "./lab.css";

const EASES = [
  { label: "부드럽게(적용 중)", value: EXPAND_TIMING.ease },
  { label: "대칭(이지 인아웃)", value: "cubic-bezier(0.65, 0, 0.35, 1)" },
  {
    label: "감속(빠르게 출발, 길게 멈춤)",
    value: "cubic-bezier(0.22, 1, 0.36, 1)",
  },
  { label: "일정하게", value: "linear" },
];

const STORAGE_KEY = "margin-lab-expand";
const SLOW_FACTOR = 4;

interface Slider {
  key: "reveal" | "hold" | "grow" | "fade" | "scale";
  label: string;
  help: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

const SLIDERS: Slider[] = [
  {
    key: "reveal",
    label: "바뀌기",
    help: "창이 가운데 작은 홈으로 바뀌는 시간. 0이면 작은 화면 없이 바로 커져요.",
    min: 0,
    max: 1200,
    step: 20,
    unit: "ms",
  },
  {
    key: "hold",
    label: "멈춤",
    help: "작은 홈에서 멈춰 있는 시간",
    min: 0,
    max: 1000,
    step: 20,
    unit: "ms",
  },
  {
    key: "grow",
    label: "커지기",
    help: "작은 홈이 화면 전체로 커지는 시간",
    min: 100,
    max: 1600,
    step: 20,
    unit: "ms",
  },
  {
    key: "fade",
    label: "그림 바뀜",
    help: "모형 그림이 실제 화면으로 바뀌는 시간",
    min: 0,
    max: 600,
    step: 20,
    unit: "ms",
  },
  {
    key: "scale",
    label: "작은 홈 크기",
    help: "화면 대비 배율",
    min: 0.4,
    max: 0.9,
    step: 0.02,
    unit: "배",
  },
];

function loadTiming(): ExpandTiming {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved === "object")
      return { ...EXPAND_TIMING, ...saved };
  } catch {
    // 저장된 값이 깨졌으면 기본값을 씁니다.
  }
  return EXPAND_TIMING;
}

function saveTiming(timing: ExpandTiming) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timing));
  } catch {
    // 저장하지 못해도 이번 화면에서는 그대로 씁니다.
  }
}

function scaled(timing: ExpandTiming, factor: number): ExpandTiming {
  return {
    ...timing,
    reveal: timing.reveal * factor,
    hold: timing.hold * factor,
    grow: timing.grow * factor,
    fade: timing.fade * factor,
  };
}

function isoDay(offset: number): string {
  const day = new Date();
  day.setDate(day.getDate() + offset);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

export function LabExpandPage() {
  const navigate = useNavigate();
  const { data } = useWorkspace();
  const [timing, setTiming] = useState(loadTiming);
  const [slow, setSlow] = useState(false);
  const [running, setRunning] = useState(false);
  const research = data.researches.find((item) => !item.deletedAt);
  const supported = canExpand();
  const total = timing.reveal + timing.hold + timing.grow;

  function update(patch: Partial<ExpandTiming>) {
    const next = { ...timing, ...patch };
    setTiming(next);
    saveTiming(next);
  }

  function expand() {
    if (!research) return;
    setRunning(true);
    void expandIntoHome(
      () => navigate(`/r/${research.id}`),
      scaled(timing, slow ? SLOW_FACTOR : 1),
    ).finally(() => setRunning(false));
  }

  return (
    <div className="ob-page lab-expand">
      <div className="ob-form-side">
        <div className="lab-expand-copy">
          <p className="lab-eyebrow">시안 · 직접 바꿔 보세요</p>
          <h1>미리보기 창이 내 연구 홈으로</h1>
          <p>
            값을 바꾸고 ‘내 연구 홈으로’를 누르면 바로 그 값으로 재생돼요. 다시
            보려면 브라우저의 뒤로 가기를 누르세요. 값은 이 브라우저에 남아요.
          </p>
          <div className="lab-sliders">
            {SLIDERS.map((slider) => (
              <label key={slider.key} title={slider.help}>
                <span>{slider.label}</span>
                <input
                  type="range"
                  min={slider.min}
                  max={slider.max}
                  step={slider.step}
                  value={timing[slider.key]}
                  onChange={(event) =>
                    update({ [slider.key]: Number(event.target.value) })
                  }
                />
                <output>
                  {timing[slider.key]}
                  {slider.unit}
                </output>
              </label>
            ))}
            <label>
              <span>속도 곡선</span>
              <select
                value={timing.ease}
                onChange={(event) => update({ ease: event.target.value })}
              >
                {EASES.map((ease) => (
                  <option key={ease.value} value={ease.value}>
                    {ease.label}
                  </option>
                ))}
              </select>
              <output />
            </label>
          </div>
          <p className="lab-total">
            전체 {total}ms · 지금 값:{" "}
            <code>
              reveal {timing.reveal} · hold {timing.hold} · grow {timing.grow} ·
              fade {timing.fade} · scale {timing.scale}
            </code>
          </p>
          <label className="lab-slow">
            <input
              type="checkbox"
              checked={slow}
              onChange={(event) => setSlow(event.target.checked)}
            />
            {SLOW_FACTOR}배 느리게 보기
          </label>
          <div className="lab-inline">
            <Button size="lg" onClick={expand} disabled={!research || running}>
              내 연구 홈으로
            </Button>
            <Button variant="outline" onClick={() => update(EXPAND_TIMING)}>
              기본값으로
            </Button>
            <Link to="/lab/components">부품 비교 시안 →</Link>
          </div>
          {!supported && (
            <p className="lab-warning">
              이 브라우저는 화면 전환 기능이 없거나 동작 줄이기가 켜져 있어 바로
              이동해요.
            </p>
          )}
          {!research && (
            <p className="lab-warning">열 수 있는 연구가 없어요.</p>
          )}
        </div>
      </div>
      <div className="ob-preview-side ob-preview-full">
        <HomePreview
          name={research?.name ?? "연구 도구 사용 경험"}
          description={research?.description ?? ""}
          phaseTitle="연구 설계"
          meeting={{ title: "제6차 논문 지도", date: isoDay(3), time: "14:00" }}
          leadLabel="미팅 준비하기"
          today={isoDay(0)}
        />
        <p className="ob-preview-note">
          미리보기예요. 답한 내용이 내 연구 홈에 이렇게 보여요.
        </p>
      </div>
    </div>
  );
}
