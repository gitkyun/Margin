import type { ChecklistItem } from "@/lib/onboarding";

const seenKey = (researchId: string) =>
  `margin-start-checklist-seen:${researchId}`;

/**
 * 이 브라우저에서 마지막으로 본 ‘끝낸 항목’. 처음 보면 null.
 * 서버에 저장하지 않으며, 체크 모션을 한 번만 재생하는 데만 씁니다.
 */
export function readSeenDone(researchId: string): string[] | null {
  try {
    const raw = localStorage.getItem(seenKey(researchId));
    const value: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(value)
      ? value.filter((key): key is string => typeof key === "string")
      : null;
  } catch {
    return null;
  }
}

export function writeSeenDone(researchId: string, keys: string[]): void {
  try {
    localStorage.setItem(seenKey(researchId), JSON.stringify(keys));
  } catch {
    // 저장소를 쓸 수 없으면 다음에 모션이 한 번 더 보일 뿐이에요.
  }
}

export interface ChecklistMotion {
  /** 지난번에 본 뒤 새로 끝낸 항목(체크 선을 그려요) */
  newlyDone: Set<string>;
  /** 진행 막대가 출발할 비율(0~1). 새로 끝낸 항목만큼 모자란 곳에서 시작해요. */
  startRatio: number;
  /** 모두 끝냈고, 끝나기 전 상태를 본 적이 있어 완료 문구를 한 번 보여 줄 때 */
  celebrate: boolean;
}

export function checklistMotion(
  items: Pick<ChecklistItem, "key" | "done">[],
  seen: string[] | null,
): ChecklistMotion {
  const total = items.length;
  const done = items.filter((item) => item.done);
  const newlyDone = new Set(
    seen === null
      ? []
      : done.filter((item) => !seen.includes(item.key)).map((item) => item.key),
  );
  return {
    newlyDone,
    startRatio: total ? (done.length - newlyDone.size) / total : 0,
    celebrate:
      total > 0 &&
      done.length === total &&
      seen !== null &&
      seen.filter((key) => items.some((item) => item.key === key)).length <
        total,
  };
}
