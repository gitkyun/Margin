import { useState } from "react";
import { Link } from "react-router-dom";
import { Icon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { ChecklistItem } from "@/lib/onboarding";

const hiddenKey = (researchId: string) =>
  `margin-start-checklist-hidden:${researchId}`;

/** 닫은 상태는 이 브라우저에만 연구별로 기억합니다(서버에 저장하지 않음). */
export function isStartChecklistHidden(researchId: string): boolean {
  try {
    return localStorage.getItem(hiddenKey(researchId)) === "true";
  } catch {
    return false;
  }
}

interface StartChecklistProps {
  researchId: string;
  items: ChecklistItem[];
  onHide(): void;
}

/**
 * 새 연구의 ‘시작하기 n/4’. 끝난 항목은 있는 기록에서 계산하고(lib/onboarding.ts),
 * 다 끝나면 홈이 이 카드를 내지 않습니다. 그전에도 닫을 수 있습니다.
 */
export function StartChecklist({
  researchId,
  items,
  onHide,
}: StartChecklistProps) {
  const done = items.filter((item) => item.done).length;
  const nextKey = items.find((item) => !item.done)?.key;
  const [hiding, setHiding] = useState(false);
  function hide() {
    if (hiding) return;
    setHiding(true);
    try {
      localStorage.setItem(hiddenKey(researchId), "true");
    } catch {
      // 저장소를 쓸 수 없으면 이번 화면에서만 닫습니다.
    }
    onHide();
  }
  return (
    <section className="rh-start" aria-labelledby="rh-start-list-heading">
      <div className="rh-start-head">
        <h2 id="rh-start-list-heading">
          시작하기
          <span className="rh-start-count">
            {done} / {items.length}
          </span>
        </h2>
        <div
          className="rh-start-progress"
          role="progressbar"
          aria-label="시작하기 진행"
          aria-valuemin={0}
          aria-valuemax={items.length}
          aria-valuenow={done}
        >
          <span style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label="시작하기 닫기"
          onClick={hide}
        >
          <Icon name="close" size={16} />
        </Button>
      </div>
      <ol className="rh-start-list">
        {items.map((item) => (
          <li key={item.key}>
            <Link
              to={item.href}
              className={`rh-start-item ${item.done ? "rh-start-done" : ""} ${item.key === nextKey ? "rh-start-next" : ""}`}
            >
              <span className="rh-start-check" aria-hidden="true">
                {item.done && <Icon name="check" size={13} />}
              </span>
              <span className="rh-start-copy">
                <strong>{item.label}</strong>
                <small>{item.done ? "끝냈어요" : item.hint}</small>
              </span>
              {!item.done && <Icon name="arrow-right" size={15} />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
