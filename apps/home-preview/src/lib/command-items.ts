import type { WorkspaceData } from "./domain";
import { commandFilter } from "./hangul-search";
import { goShortcutLabel } from "./go-shortcuts";
import { t } from "./i18n";

/** 검색 보조어. 한국어로 치는 말과 일본어로 치는 말을 함께 둡니다(화면에 보이지 않음). */
const KEYWORDS = {
  newResearch: ["연구 추가", "研究を追加"], // i18n-ignore
  newMeeting: ["미팅 추가", "회의", "ミーティングを追加", "会議"], // i18n-ignore
  newTask: ["할 일 만들기", "투두", "タスクを作成", "ToDo"], // i18n-ignore
  newResult: ["수정 결과 만들기", "고친 내용", "修正結果を作成"], // i18n-ignore
  newReview: ["교수 검토", "리뷰 요청", "先生のレビュー"], // i18n-ignore
  newWriting: ["문서 만들기", "새 글", "文書を作成", "新しい原稿"], // i18n-ignore
  researchList: ["연구 목록", "研究一覧"], // i18n-ignore
  account: ["프로필", "プロフィール"], // i18n-ignore
  guide: ["도움말", "ヘルプ"], // i18n-ignore
};

/** 연구 안 사이드바 메뉴: [경로, 아이콘, 이름]. 사이드바와 ⌘K 팔레트가 같이 씁니다. */
export const RESEARCH_NAVIGATION = [
  ["", "home", t("홈")],
  ["planning", "flag", t("일정")],
  ["meetings", "calendar", t("미팅")],
  ["writing", "file", t("문서")],
  ["feedback", "feedback", t("피드백")],
  ["tasks", "tasks", t("할 일")],
  ["materials", "folder", t("자료")],
  ["reviews", "send", t("검토 요청")],
] as const;

export type CommandAction = { kind: "navigate"; to: string };

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
const DECISION_LABEL_MAX = 60;

const RECORD_KINDS = [
  { key: "documents", type: t("문서"), path: "writing", icon: "file" },
  { key: "meetings", type: t("미팅"), path: "meetings", icon: "calendar" },
  { key: "feedback", type: t("피드백"), path: "feedback", icon: "feedback" },
  { key: "tasks", type: t("할 일"), path: "tasks", icon: "tasks" },
  { key: "materials", type: t("자료"), path: "materials", icon: "folder" },
  { key: "results", type: t("수정 결과"), path: "results", icon: "check" },
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
    Partial<Pick<WorkspaceData, "reviews" | "decisions">>,
  researchId: string,
): RecordEntry[] {
  // 검토 요청은 연구 밖 주소(/reviews/:id)라 따로 붙입니다.
  const reviews: RecordEntry[] = (data.reviews ?? [])
    .filter((r) => r.researchId === researchId)
    .map((r) => ({
      id: `record:reviews:${r.id}`,
      label: r.title || t("제목 없음"),
      icon: "send",
      hint: t("검토 요청"),
      keywords: [r.title, t("검토 요청"), r.professorEmail],
      updatedAt: r.updatedAt,
      action: { kind: "navigate" as const, to: `/reviews/${r.id}` },
    }));
  // 결정은 제목이 없어 글 앞부분을 이름으로 쓰고, 적힌 미팅의 결정·질문 탭으로 갑니다.
  const decisions: RecordEntry[] = (data.decisions ?? [])
    .filter((d) => d.researchId === researchId && !d.archivedAt)
    .map((d) => ({
      id: `record:decisions:${d.id}`,
      label: d.text.slice(0, DECISION_LABEL_MAX),
      icon: "check",
      hint: t("결정"),
      keywords: [d.text, t("결정"), d.reason ?? ""],
      updatedAt: d.updatedAt,
      action: {
        kind: "navigate" as const,
        to: `/r/${researchId}/meetings/${d.meetingId}?tab=questions`,
      },
    }));
  return [
    ...RECORD_KINDS.flatMap((kind) =>
      (data[kind.key] as TitledRecord[])
        .filter((r) => r.researchId === researchId && !r.archivedAt)
        .map((r) => ({
          id: `record:${kind.key}:${r.id}`,
          label: r.title || t("제목 없음"),
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
    ...decisions,
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
    t("새 연구 만들기"),
    "plus",
    "/r?new=1",
    KEYWORDS.newResearch,
  );
  if (!researchId) return [newResearch];
  const base = `/r/${researchId}`;
  return [
    navigateEntry(
      "create:meeting",
      t("미팅 만들기"),
      "calendar",
      `${base}/meetings?new=1`,
      KEYWORDS.newMeeting,
    ),
    navigateEntry(
      "create:task",
      t("할 일 추가"),
      "tasks",
      `${base}/tasks?new=1`,
      KEYWORDS.newTask,
    ),
    navigateEntry(
      "create:result",
      t("수정 결과 작성"),
      "check",
      `${base}/results?new=1`,
      KEYWORDS.newResult,
    ),
    navigateEntry(
      "create:review",
      t("검토 요청 만들기"),
      "send",
      `${base}/reviews?new=1`,
      KEYWORDS.newReview,
    ),
    navigateEntry(
      "create:writing",
      t("글 새로 쓰기"),
      "file",
      `${base}/writing?new=1`,
      KEYWORDS.newWriting,
    ),
    newResearch,
  ];
}

function goEntries(researchId: string | undefined): CommandEntry[] {
  const common = [
    navigateEntry(
      "go:research-list",
      t("내 연구"),
      "book",
      "/r",
      KEYWORDS.researchList,
    ),
    navigateEntry(
      "go:account",
      t("계정 설정"),
      "user",
      "/account",
      KEYWORDS.account,
    ),
    navigateEntry("go:guide", t("사용 안내"), "help", "/guide", KEYWORDS.guide),
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
    navigateEntry("go:results", t("수정 결과"), "check", `${base}/results`),
    withShortcut(
      navigateEntry(
        "go:assistant",
        t("연구 도우미"),
        "sparkles",
        `${base}/assistant`,
        ["AI"],
      ),
      "assistant",
    ),
    withShortcut(
      navigateEntry(
        "go:settings",
        t("연구 설정"),
        "settings",
        `${base}/settings`,
      ),
      "settings",
    ),
    ...common,
  ];
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
      hint: t("연구"),
      keywords: [r.name, t("연구")],
      action: { kind: "navigate", to: `/r/${r.id}` },
    }));
}

/**
 * ⌘K 팔레트 묶음. 빈 입력이면 최근 기록·만들기·이동을,
 * 입력이 있으면 기록 전체와 다른 연구도 함께 넣고 cmdk가 걸러 냅니다.
 */
export function buildCommands({
  data,
  researchId,
  searching,
}: {
  data: WorkspaceData;
  researchId?: string;
  searching: boolean;
}): CommandSection[] {
  const records = researchId ? recordEntries(data, researchId) : [];
  const showResearches = searching || !researchId;
  const sections: CommandSection[] = [
    searching
      ? { id: "records", heading: t("기록"), entries: records }
      : {
          id: "recent",
          heading: t("최근 기록"),
          entries: recentEntries(records),
        },
    { id: "create", heading: t("만들기"), entries: createEntries(researchId) },
    { id: "go", heading: t("이동"), entries: goEntries(researchId) },
    {
      id: "researches",
      heading: researchId ? t("다른 연구로") : t("연구"),
      entries: showResearches ? researchEntries(data, researchId) : [],
    },
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
