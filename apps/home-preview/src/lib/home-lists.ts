import type { Task } from "./domain";

/** 홈 목록 탭 넷(IA v2 03 §5) */
export const HOME_TABS = ["tasks", "alerts", "meetings", "docs"] as const;
export type HomeTab = (typeof HOME_TABS)[number];

const KEY = "margin-home-tab";

function isTab(value: unknown): value is HomeTab {
  return (HOME_TABS as readonly unknown[]).includes(value);
}

/** 주소의 `?tab=`이 먼저, 없으면 이 연구에서 마지막으로 본 탭, 그것도 없으면 할 일. */
export function readHomeTab(
  fromUrl: string | null,
  researchId: string,
): HomeTab {
  if (isTab(fromUrl)) return fromUrl;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}")[researchId];
    if (isTab(saved)) return saved;
  } catch {
    // 저장소를 못 쓰면 기본값으로 봅니다.
  }
  return "tasks";
}

export function rememberHomeTab(researchId: string, tab: HomeTab): void {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    saved[researchId] = tab;
    localStorage.setItem(KEY, JSON.stringify(saved));
  } catch {
    // 이 브라우저에 남기지 못해도 주소의 탭은 그대로입니다.
  }
}

/**
 * 홈 할 일 탭의 순서(03 §5.1): ① 다음 미팅에 가져갈 할 일(그 미팅의 `taskIds` 순서)
 * ② 나머지(기한 가까운 순, 기한 없는 것은 뒤).
 */
export function homeTaskOrder(
  tasks: Task[],
  nextTaskIds: string[],
): { first: Task[]; rest: Task[] } {
  const first = nextTaskIds
    .map((id) => tasks.find((task) => task.id === id))
    .filter((task): task is Task => !!task);
  const rest = tasks
    .filter((task) => !nextTaskIds.includes(task.id))
    .sort(
      (a, b) =>
        (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  return { first, rest };
}
