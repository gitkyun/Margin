/** 글·자료 열어 둔 탭(IA v2 05 §3.2). 연구별로 이 브라우저에 8개까지 기억합니다(08 §6). */
export interface OpenTab {
  kind: "w" | "m";
  id: string;
  /** 마지막으로 본 때(ms). 넘치면 가장 오래 안 본 탭이 빠집니다. */
  seen: number;
}

export const TAB_LIMIT = 8;
const key = (researchId: string) => `margin-docs-tabs:${researchId}`;

export function readTabs(researchId: string): OpenTab[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key(researchId)) ?? "[]");
    return Array.isArray(raw)
      ? raw
          .filter(
            (t) =>
              (t?.kind === "w" || t?.kind === "m") &&
              typeof t.id === "string" &&
              typeof t.seen === "number",
          )
          .slice(0, TAB_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function writeTabs(researchId: string, tabs: readonly OpenTab[]) {
  try {
    localStorage.setItem(key(researchId), JSON.stringify(tabs));
  } catch {
    // 저장소를 못 쓰면 기억하지 않을 뿐 오류를 내지 않습니다(09 C18).
  }
}

/** 탭을 열거나(없으면 끝에 더함) 본 때를 새로 합니다. 8개를 넘으면 가장 오래 안 본 탭을 뺍니다. */
export function openTab(
  tabs: readonly OpenTab[],
  tab: Omit<OpenTab, "seen">,
  now: number,
): OpenTab[] {
  const at = tabs.findIndex((t) => t.kind === tab.kind && t.id === tab.id);
  if (at >= 0) return tabs.map((t, i) => (i === at ? { ...t, seen: now } : t));
  let next = [...tabs, { ...tab, seen: now }];
  while (next.length > TAB_LIMIT) {
    const oldest = next
      .slice(0, -1)
      .reduce((a, b) => (b.seen < a.seen ? b : a));
    next = next.filter((t) => t !== oldest);
  }
  return next;
}

export function closeTab(
  tabs: readonly OpenTab[],
  tab: Pick<OpenTab, "kind" | "id">,
): OpenTab[] {
  return tabs.filter((t) => !(t.kind === tab.kind && t.id === tab.id));
}

/** 탭 순서 바꾸기(끌기와 메뉴 '왼쪽으로'·'오른쪽으로'가 함께 씀) */
export function moveTab(
  tabs: readonly OpenTab[],
  from: number,
  to: number,
): OpenTab[] {
  if (from === to || from < 0 || from >= tabs.length) return [...tabs];
  const target = Math.max(0, Math.min(tabs.length - 1, to));
  const next = [...tabs];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved!);
  return next;
}

/** 닫은 탭 다음에 갈 탭: 오른쪽, 없으면 왼쪽 */
export function neighborTab(
  tabs: readonly OpenTab[],
  tab: Pick<OpenTab, "kind" | "id">,
): OpenTab | undefined {
  const at = tabs.findIndex((t) => t.kind === tab.kind && t.id === tab.id);
  if (at < 0) return undefined;
  return tabs[at + 1] ?? tabs[at - 1];
}
