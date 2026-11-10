import type { WorkspaceData } from "./domain";
import type { ThemePreference } from "./theme";
import { commandFilter } from "./hangul-search";
import { goShortcutLabel } from "./go-shortcuts";

/** 연구 안 사이드바 메뉴: [경로, 아이콘, 이름]. 사이드바와 ⌘K 팔레트가 같이 씁니다. */
export const RESEARCH_NAVIGATION = [
  ["", "home", "연구 홈"],
  ["planning", "flag", "계획·일정"],
  ["meetings", "calendar", "미팅"],
  ["writing", "file", "글쓰기"],
  ["feedback", "feedback", "피드백·수정"],
  ["materials", "folder", "자료"],
  ["reviews", "send", "검토 요청"],
] as const;

export type CommandAction =
  { kind: "navigate"; to: string } | { kind: "theme"; value: ThemePreference };

export interface CommandEntry {
  /** cmdk value. 겹치지 않아야 해서 종류와 id를 붙입니다. */
  id: string;
  label: string;
  icon: string;
  /** 오른쪽에 작게 붙는 설명(기록 종류, 현재 테마 등) */
  hint?: string;
  /** 오른쪽에 키 모양으로 보여 줄 단축키(예: "G H") */
  shortcut?: string;
  /** 검색에 쓰는 말. 첫 번째는 항상 보이는 이름 */
  keywords: string[];
  action: CommandAction;
}

export interface CommandSection {
  id: string;
  heading: string;
  entries: CommandEntry[];
}

const RECENT_LIMIT = 5;

const RECORD_KINDS = [
  { key: "documents", type: "문서", path: "writing", icon: "file" },
  { key: "meetings", type: "미팅", path: "meetings", icon: "calendar" },
  { key: "feedback", type: "피드백", path: "feedback", icon: "feedback" },
  { key: "tasks", type: "할 일", path: "tasks", icon: "tasks" },
  { key: "materials", type: "자료", path: "materials", icon: "folder" },
  { key: "results", type: "수정 결과", path: "results", icon: "check" },
] as const;

type RecordKey = (typeof RECORD_KINDS)[number]["key"];

interface TitledRecord {
  id: string;
  researchId: string;
  title: string;
  updatedAt: string;
  archivedAt?: string;
}

interface RecordEntry extends CommandEntry {
  updatedAt: string;
}

/** 이 연구의 보관하지 않은 기록(문서·미팅·피드백·할 일·자료·수정 결과·검토 요청). */
export function recordEntries(
  data: Pick<WorkspaceData, RecordKey> &
    Partial<Pick<WorkspaceData, "reviews">>,
  researchId: string,
): RecordEntry[] {
  // 검토 요청은 연구 밖 주소(/reviews/:id)라 따로 붙입니다.
  const reviews: RecordEntry[] = (data.reviews ?? [])
    .filter((r) => r.researchId === researchId)
    .map((r) => ({
      id: `record:reviews:${r.id}`,
      label: r.title || "제목 없음",
      icon: "send",
      hint: "검토 요청",
      keywords: [r.title, "검토 요청", r.professorEmail],
      updatedAt: r.updatedAt,
      action: { kind: "navigate" as const, to: `/reviews/${r.id}` },
    }));
  return [
    ...RECORD_KINDS.flatMap((kind) =>
      (data[kind.key] as TitledRecord[])
        .filter((r) => r.researchId === researchId && !r.archivedAt)
        .map((r) => ({
          id: `record:${kind.key}:${r.id}`,
          label: r.title || "제목 없음",
          icon: kind.icon,
          hint: kind.type,
          keywords: [r.title, kind.type],
          updatedAt: r.updatedAt,
          action: {
            kind: "navigate" as const,
            to: `/r/${researchId}/${kind.path}/${r.id}`,
          },
        })),
    ),
    ...reviews,
  ];
}

/** 최근에 고친 기록 몇 개(빈 입력일 때 맨 위에 보여 줌). */
export function recentEntries(records: RecordEntry[]): CommandEntry[] {
  return [...records]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, RECENT_LIMIT)
    .map((record) => ({
      id: record.id.replace("record:", "recent:"),
      label: record.label,
      icon: record.icon,
      hint: record.hint,
      keywords: record.keywords,
      action: record.action,
    }));
}

function navigateEntry(
  id: string,
  label: string,
  icon: string,
  to: string,
  keywords: string[] = [],
): CommandEntry {
  return {
    id,
    label,
    icon,
    keywords: [label, ...keywords],
    action: { kind: "navigate", to },
  };
}

function createEntries(researchId: string | undefined): CommandEntry[] {
  const newResearch = navigateEntry(
    "create:research",
    "새 연구 만들기",
    "plus",
    "/r?new=1",
    ["연구 추가"],
  );
  if (!researchId) return [newResearch];
  const base = `/r/${researchId}`;
  return [
    navigateEntry(
      "create:meeting",
      "미팅 만들기",
      "calendar",
      `${base}/meetings?new=1`,
      ["미팅 추가", "회의"],
    ),
    navigateEntry("create:task", "할 일 추가", "tasks", `${base}/tasks?new=1`, [
      "할 일 만들기",
      "투두",
    ]),
    navigateEntry(
      "create:result",
      "수정 결과 작성",
      "check",
      `${base}/results?new=1`,
      ["수정 결과 만들기", "고친 내용"],
    ),
    navigateEntry(
      "create:review",
      "검토 요청 만들기",
      "send",
      `${base}/reviews?new=1`,
      ["교수 검토", "리뷰 요청"],
    ),
    navigateEntry(
      "create:writing",
      "글 새로 쓰기",
      "file",
      `${base}/writing?new=1`,
      ["문서 만들기", "새 글"],
    ),
    newResearch,
  ];
}

function goEntries(researchId: string | undefined): CommandEntry[] {
  const common = [
    navigateEntry("go:research-list", "내 연구", "book", "/r", ["연구 목록"]),
    navigateEntry("go:account", "계정 설정", "user", "/account", ["프로필"]),
    navigateEntry("go:guide", "사용 안내", "help", "/guide", ["도움말"]),
  ];
  if (!researchId) return common;
  const base = `/r/${researchId}`;
  const withShortcut = (entry: CommandEntry, path: string): CommandEntry => ({
    ...entry,
    shortcut: goShortcutLabel(path),
  });
  return [
    ...RESEARCH_NAVIGATION.map(([path, icon, label]) =>
      withShortcut(
        navigateEntry(
          `go:${path || "home"}`,
          label,
          icon,
          path ? `${base}/${path}` : base,
        ),
        path,
      ),
    ),
    withShortcut(
      navigateEntry("go:tasks", "할 일", "tasks", `${base}/tasks`),
      "tasks",
    ),
    navigateEntry("go:results", "수정 결과", "check", `${base}/results`),
    withShortcut(
      navigateEntry(
        "go:assistant",
        "연구 도우미",
        "sparkles",
        `${base}/assistant`,
        ["AI"],
      ),
      "assistant",
    ),
    withShortcut(
      navigateEntry("go:settings", "연구 설정", "settings", `${base}/settings`),
      "settings",
    ),
    ...common,
  ];
}

const THEME_ENTRIES: {
  value: ThemePreference;
  label: string;
  icon: string;
  keywords: string[];
}[] = [
  {
    value: "light",
    label: "라이트 화면으로",
    icon: "sun",
    keywords: ["밝게", "테마"],
  },
  {
    value: "dark",
    label: "다크 화면으로",
    icon: "moon",
    keywords: ["어둡게", "테마"],
  },
  {
    value: "system",
    label: "시스템 설정 따르기",
    icon: "monitor",
    keywords: ["자동", "테마"],
  },
];

function themeEntries(current: ThemePreference): CommandEntry[] {
  return THEME_ENTRIES.map((t) => ({
    id: `theme:${t.value}`,
    label: t.label,
    icon: t.icon,
    hint: t.value === current ? "지금" : undefined,
    keywords: [t.label, ...t.keywords],
    action: { kind: "theme", value: t.value },
  }));
}

function researchEntries(
  data: Pick<WorkspaceData, "researches">,
  researchId: string | undefined,
): CommandEntry[] {
  return data.researches
    .filter((r) => !r.deletedAt && !r.archivedAt && r.id !== researchId)
    .map((r) => ({
      id: `research:${r.id}`,
      label: r.name,
      icon: "book",
      hint: "연구",
      keywords: [r.name, "연구"],
      action: { kind: "navigate", to: `/r/${r.id}` },
    }));
}

/**
 * ⌘K 팔레트 묶음. 빈 입력이면 최근 기록·만들기·이동·테마를,
 * 입력이 있으면 기록 전체와 다른 연구도 함께 넣고 cmdk가 걸러 냅니다.
 */
export function buildCommands({
  data,
  researchId,
  theme,
  searching,
}: {
  data: WorkspaceData;
  researchId?: string;
  theme: ThemePreference;
  searching: boolean;
}): CommandSection[] {
  const records = researchId ? recordEntries(data, researchId) : [];
  const showResearches = searching || !researchId;
  const sections: CommandSection[] = [
    searching
      ? { id: "records", heading: "기록", entries: records }
      : { id: "recent", heading: "최근 기록", entries: recentEntries(records) },
    { id: "create", heading: "만들기", entries: createEntries(researchId) },
    { id: "go", heading: "이동", entries: goEntries(researchId) },
    {
      id: "researches",
      heading: researchId ? "다른 연구로" : "연구",
      entries: showResearches ? researchEntries(data, researchId) : [],
    },
    { id: "theme", heading: "화면 테마", entries: themeEntries(theme) },
  ];
  return sections.filter((s) => s.entries.length > 0);
}

/**
 * 입력이 있으면 가장 잘 맞는 항목이 있는 묶음부터 보여 줍니다.
 * (cmdk 1.1의 묶음 정렬은 묶음을 찾지 못해 동작하지 않아 여기서 정렬합니다.)
 */
export function rankSections(
  sections: CommandSection[],
  query: string,
): CommandSection[] {
  if (!query.trim()) return sections;
  const best = (section: CommandSection) =>
    Math.max(
      0,
      ...section.entries.map((e) => commandFilter(e.id, query, e.keywords)),
    );
  return sections
    .map((section, index) => ({ section, index, score: best(section) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.section);
}
