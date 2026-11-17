/** 연구 도우미가 항상 읽는 이 연구의 기록 전체(2026-11-16 사용자 결정). */
interface WorkspaceRecord {
  id: string;
  kind: string;
  data: Record<string, unknown>;
}
export interface WorkspaceContext {
  id: string;
  kind: string;
  title: string;
  text: string;
  revision?: number;
}
export type WorkspaceTask =
  | "ask_research"
  | "plan_research"
  | "organize_meeting"
  | "suggest_revisions"
  | "review_writing"
  | "read_material";

/** 읽는 종류. 미채택 AI 제안·개인 대화·녹음 파일은 읽지 않는다. */
export const WORKSPACE_KINDS = [
  "meetings",
  "feedback",
  "tasks",
  "questions",
  "decisions",
  "documents",
  "phases",
  "milestones",
  "materials",
  "attachments",
] as const;
/** 모델에 보낼 수 있는 원문 한도(50,000자)에서 머리말 몫을 뺀 값. */
export const WORKSPACE_BUDGET = 48000;
const PLAN_KINDS = new Set([
  "tasks",
  "phases",
  "milestones",
  "meetings",
  "feedback",
]);
/** 종류별 한 건의 최대 글자 수. 긴 기록 하나가 나머지를 밀어내지 않게 한다. */
const PER_RECORD: Record<string, number> = {
  meetings: 4000,
  feedback: 2000,
  documents: 8000,
  attachments: 6000,
};
const DEFAULT_PER_RECORD = 800;
const KIND_LABEL: Record<string, string> = {
  meetings: "미팅",
  feedback: "피드백",
  tasks: "할 일",
  questions: "질문",
  decisions: "결정",
  documents: "문서",
  phases: "연구 단계",
  milestones: "주요 목표",
  materials: "자료",
  attachments: "첨부 파일",
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const line = (label: string, v: unknown) =>
  str(v) ? `${label}: ${str(v)}` : "";

function alive(row: WorkspaceRecord): boolean {
  return (
    WORKSPACE_KINDS.includes(row.kind as (typeof WORKSPACE_KINDS)[number]) &&
    !row.data.archivedAt &&
    !row.data.deletedAt &&
    row.data.status !== "cancelled"
  );
}

/** 기록 한 건의 원문. 선택한 기록을 서버가 읽을 때와 같은 칸을 쓴다. */
export function recordBody(row: WorkspaceRecord): string {
  const d = row.data;
  const parts =
    row.kind === "meetings"
      ? [
          line("날짜", d.date),
          line("시간", d.time),
          line("목표", d.goal),
          str(d.memo),
        ]
      : row.kind === "feedback"
        ? [line("상태", d.status), str(d.body), line("메모", d.notes)]
        : row.kind === "tasks"
          ? [
              line("상태", d.status),
              line("기한", d.dueDate),
              str(d.description),
            ]
          : row.kind === "questions"
            ? [line("상태", d.status), str(d.text)]
            : row.kind === "decisions"
              ? [str(d.text), line("이유", d.reason)]
              : row.kind === "documents" || row.kind === "attachments"
                ? [str(d.text)]
                : row.kind === "phases"
                  ? [
                      line("상태", d.status),
                      line("시작", d.startDate),
                      line("목표일", d.dueDate),
                      str(d.goal),
                    ]
                  : row.kind === "milestones"
                    ? [line("상태", d.status), line("목표일", d.dueDate)]
                    : [line("종류", d.type), line("링크", d.externalUrl)];
  return parts.filter(Boolean).join("\n");
}

function title(row: WorkspaceRecord): string {
  const d = row.data;
  const name = str(d.title) || str(d.fileName) || str(d.text).slice(0, 40);
  return `${KIND_LABEL[row.kind] ?? "기록"} · ${name || "제목 없음"}`.slice(
    0,
    200,
  );
}

/** 대상이 하나인 요청은 발췌 확인과 버전 대조를 위해 저장된 원문 그대로 쓴다. */
function rawBody(row: WorkspaceRecord): string {
  const d = row.data;
  return str(
    row.kind === "meetings"
      ? d.memo
      : row.kind === "feedback"
        ? d.body
        : d.text,
  );
}

function toContext(
  row: WorkspaceRecord,
  max: number,
  raw = false,
): WorkspaceContext {
  const body = raw ? rawBody(row) : recordBody(row);
  const revision =
    row.kind === "meetings"
      ? row.data.memoRevision
      : row.kind === "documents"
        ? row.data.revision
        : undefined;
  return {
    id: row.id,
    kind: row.kind,
    title: title(row),
    text:
      body.length > max
        ? body.slice(0, max) + "\n(길어서 여기까지만 읽었어요)"
        : body,
    ...(typeof revision === "number" ? { revision } : {}),
  };
}

/**
 * 요청 종류에 맞춰 이 연구의 기록을 고른다. rows는 요청한 사람의 권한(RLS)으로 읽은 최신순 목록이어야 한다.
 * - 질문·할 일 정리: 한도 안에서 최신 기록부터 전부.
 * - 미팅 정리·수정 방법 제안·원고 검토·자료 요약: 대상이 하나여야 하므로 가장 최근 것 하나.
 */
export function workspaceContexts(
  rows: WorkspaceRecord[],
  task: WorkspaceTask,
  options: { exclude?: Set<string>; budget?: number } = {},
): WorkspaceContext[] {
  const live = rows.filter(
    (row) => alive(row) && !options.exclude?.has(row.id),
  );
  const single = (kind: string, ok: (row: WorkspaceRecord) => boolean) => {
    const row = live.find((r) => r.kind === kind && ok(r));
    return row ? [toContext(row, WORKSPACE_BUDGET, true)] : [];
  };
  if (task === "organize_meeting")
    return single("meetings", (r) => !!str(r.data.memo));
  if (task === "suggest_revisions") {
    const open = single(
      "feedback",
      (r) =>
        !!str(r.data.body) &&
        (r.data.status === "unprocessed" || r.data.status === "in_progress"),
    );
    return open.length ? open : single("feedback", (r) => !!str(r.data.body));
  }
  if (task === "review_writing")
    return single("documents", (r) => !!str(r.data.text));
  if (task === "read_material")
    return single("attachments", (r) => !!str(r.data.text));
  let left = options.budget ?? WORKSPACE_BUDGET;
  const out: WorkspaceContext[] = [];
  for (const row of live) {
    if (task === "plan_research" && !PLAN_KINDS.has(row.kind)) continue;
    const context = toContext(
      row,
      Math.min(PER_RECORD[row.kind] ?? DEFAULT_PER_RECORD, left),
    );
    const size = context.title.length + context.text.length + 16;
    if (size > left) break;
    out.push(context);
    left -= size;
  }
  return out;
}

export function workspaceSourceText(contexts: WorkspaceContext[]): string {
  return contexts
    .map((c, i) => `[근거 ${i + 1}] ${c.title}\n${c.text}`)
    .join("\n\n");
}
