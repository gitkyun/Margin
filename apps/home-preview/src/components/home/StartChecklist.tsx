import { t } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "motion/react";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { ChecklistItem } from "@/lib/onboarding";
import {
  checklistMotion,
  readSeenDone,
  writeSeenDone,
} from "./start-checklist-state";

const hiddenKey = (researchId: string) =>
  `margin-start-checklist-hidden:${researchId}`;

/** 체크 선을 다 그리고 완료 문구로 바꾸기까지 */
const CELEBRATE_DELAY_MS = 700;
/** 완료 문구를 읽을 시간. 이 뒤에 카드가 접혀요. */
const CELEBRATE_HOLD_MS = 1800;
/** 카드가 접히는 시간(초, --motion-duration-page와 같은 300ms) */
const COLLAPSE_SECONDS = 0.3;

/** 닫은 상태는 이 브라우저에만 연구별로 기억합니다(서버에 저장하지 않음). */
export function isStartChecklistHidden(researchId: string): boolean {
  try {
    return localStorage.getItem(hiddenKey(researchId)) === "true";
  } catch {
    return false;
  }
}

/**
 * 모두 끝냈지만 끝나기 전 모습을 이 브라우저에서 본 적이 있으면, 완료 문구를 한 번 보여 줘야 해요.
 * 홈은 이때도 카드를 냅니다.
 */
export function shouldCelebrateStartChecklist(
  researchId: string,
  items: ChecklistItem[],
): boolean {
  return checklistMotion(items, readSeenDone(researchId)).celebrate;
}

interface StartChecklistProps {
  researchId: string;
  items: ChecklistItem[];
  onHide(): void;
  /** 완료 문구를 보여 주고 접힌 뒤 */
  onFinish?(): void;
}

/**
 * 새 연구의 ‘시작하기 n/4’. 끝난 항목은 있는 기록에서 계산하고(lib/onboarding.ts),
 * 지난번에 본 뒤 새로 끝낸 항목은 체크 선을 그리고 진행 막대를 부드럽게 채워요.
 * 마지막 항목을 끝내면 짧은 완료 문구를 보여 준 뒤 접혀요. 그전에도 닫을 수 있어요.
 */
export function StartChecklist({
  researchId,
  items,
  onHide,
  onFinish,
}: StartChecklistProps) {
  const reduced = useReducedMotion();
  // 이 화면을 처음 그릴 때 한 번만 계산해요. 저장해도 이번 모션은 바뀌지 않아요.
  const [motionPlan] = useState(() =>
    checklistMotion(items, readSeenDone(researchId)),
  );
  const done = items.filter((item) => item.done).length;
  const ratio = items.length ? done / items.length : 0;
  const nextKey = items.find((item) => !item.done)?.key;
  const [hiding, setHiding] = useState(false);
  // 막대는 지난번 위치에서 출발해 다음 프레임에 지금 위치로 움직여요.
  const [shownRatio, setShownRatio] = useState(motionPlan.startRatio);
  const [phase, setPhase] = useState<"list" | "complete" | "collapsing">(
    "list",
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => setShownRatio(ratio));
    return () => cancelAnimationFrame(frame);
  }, [ratio]);

  // 완료가 아니면 지금 본 상태를 바로 기억해요. 완료 축하는 접힌 뒤에 기억해요(그래야 도중에 사라지지 않아요).
  const doneKeys = items
    .filter((item) => item.done)
    .map((item) => item.key)
    .join(",");
  useEffect(() => {
    if (motionPlan.celebrate) return;
    writeSeenDone(researchId, doneKeys ? doneKeys.split(",") : []);
  }, [researchId, doneKeys, motionPlan.celebrate]);

  useEffect(() => {
    if (!motionPlan.celebrate) return;
    const show = window.setTimeout(
      () => setPhase("complete"),
      reduced ? 0 : CELEBRATE_DELAY_MS,
    );
    const collapse = window.setTimeout(
      () => setPhase("collapsing"),
      (reduced ? 0 : CELEBRATE_DELAY_MS) + CELEBRATE_HOLD_MS,
    );
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(collapse);
    };
  }, [motionPlan.celebrate, reduced]);

  function finish() {
    writeSeenDone(
      researchId,
      items.map((item) => item.key),
    );
    onFinish?.();
  }

  function hide() {
    if (hiding) return;
    setHiding(true);
    try {
      localStorage.setItem(hiddenKey(researchId), "true");
    } catch {
      // 저장소를 쓸 수 없으면 이번 화면에서만 닫습니다.
    }
    if (motionPlan.celebrate) finish();
    onHide();
  }

  const collapsing = phase === "collapsing";
  return (
    <motion.section
      className={`rh-start${phase !== "list" ? " is-complete" : ""}`}
      aria-labelledby="rh-start-list-heading"
      initial={false}
      animate={
        collapsing
          ? {
              height: 0,
              opacity: 0,
              marginBottom: 0,
              paddingTop: 0,
              paddingBottom: 0,
            }
          : undefined
      }
      transition={{
        duration: reduced ? 0 : COLLAPSE_SECONDS,
        ease: [0.2, 0, 0, 1],
      }}
      style={collapsing ? { overflow: "hidden" } : undefined}
      onAnimationComplete={() => {
        if (collapsing) finish();
      }}
    >
      <div className="rh-start-head">
        <h2 id="rh-start-list-heading">
          {t("시작하기")}
          <span className="rh-start-count">
            {`${Math.round(shownRatio * items.length)} / ${items.length}`}
          </span>
        </h2>
        <div
          className="rh-start-progress"
          role="progressbar"
          aria-label={t("시작하기 진행")}
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
        >
          <span style={{ width: `${shownRatio * 100}%` }} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t("시작하기 닫기")}
          onClick={hide}
        >
          <Icon name="close" size={16} />
        </Button>
      </div>
      {phase !== "list" && (
        <p className="rh-start-complete text-swap" role="status">
          <Icon name="check-circle" size={18} />
          {t("시작하기를 모두 끝냈어요. 이제 이 카드는 접을게요.")}
        </p>
      )}
      <ol className="rh-start-list" hidden={phase !== "list"}>
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.href}
              className={`rh-start-item ${item.done ? "rh-start-done" : ""} ${item.key === nextKey ? "rh-start-next" : ""} ${motionPlan.newlyDone.has(item.key) ? "is-new" : ""}`}
            >
              <span className="rh-start-check" aria-hidden="true">
                {item.done && (
                  <svg
                    className="rh-start-tick"
                    viewBox="0 0 16 16"
                    width="13"
                    height="13"
                  >
                    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" pathLength={1} />
                  </svg>
                )}
              </span>
              <span className="rh-start-copy">
                <strong>{item.label}</strong>
                <small>{item.done ? t("끝냈어요") : item.hint}</small>
              </span>
              {!item.done && <Icon name="arrow-right" size={15} />}
            </Link>
          </li>
        ))}
      </ol>
    </motion.section>
  );
}
