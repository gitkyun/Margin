import { dateLocale, t } from "@/lib/i18n";
import { timeParts } from "./time-format";
export type ID = string;
export type RecordOrigin = "manual" | "ai";
export interface BaseRecord {
  id: ID;
  researchId: ID;
  createdAt: string;
  updatedAt: string;
  createdBy?: ID;
  updatedBy?: ID;
  visibility?: "private" | "shared";
  archivedAt?: string;
}
export interface Research {
  id: ID;
  ownerId: ID;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nextMeetingId?: ID;
  currentPhaseId?: ID;
  /** 연구 목적 한두 문장. 온보딩·연구 설정에서 적고 홈에 보여 줍니다. */
  purpose?: string;
  /** 연구 질문 목록(최대 5개). */
  questions?: string[];
  /** 이 연구의 지도교수 이메일(소문자). 검토 요청을 만들 때 여기서 고릅니다. */
  advisorEmails?: string[];
  /** 투고·제출 목표일(YYYY-MM-DD). 온보딩·연구 설정에서 적고 홈 D-Day와 로드맵 제안에 씁니다. */
  submissionDate?: string;
  /** 연구 키워드(최대 10개). 연구 설정 기본 정보에서 칩으로 적어요. */
  keywords?: string[];
  /** 목표 학회·학술지 인용 양식 프리셋(apa7·ieee·acm·chicago·mla). lib/research-profile 참고 */
  citationStyle?: string;
  deletedAt?: string;
  example?: boolean;
  archivedAt?: string;
  /** 연구를 끝냈다고 표시한 시각. 내 연구의 ‘완료된 연구’에 모여요(보관·휴지통과 별개). */
  completedAt?: string;
}
/** 메모 형광펜 한 칸. 전사 형광펜(TranscriptMark)과 같은 모양입니다(IA v2 08 §3.1). */
export interface TextMark {
  start: number;
  end: number;
  hash: string;
}
export interface Meeting extends BaseRecord {
  title: string;
  date: string | null;
  time: string | null;
  status: "preparing" | "recording" | "recorded" | "cancelled";
  goal: string;
  memo: string;
  memoRevision: number;
  taskIds: ID[];
  versionIds: ID[];
  questionIds: ID[];
  /** 기록 종류. 없으면 미팅. 서면 피드백도 미팅 표에 둡니다(마이그레이션 없음, 08 §3.1). */
  recordType?: "meeting" | "written";
  /** 서면 피드백을 받은 곳 */
  sourceLabel?: "kakao" | "email" | "doc_comment" | "note" | "file" | "other";
  sourceFileName?: string;
  memoMarks?: TextMark[];
  /** 연구 도우미가 쓴 요약(IA v2 04 §5.4 ①). [요약 저장]을 눌러야 생깁니다. */
  summary?: MeetingSummary;
  /** 준비: 보여 줄 글 */
  documentIds?: ID[];
}
export interface MeetingSummary {
  text: string;
  createdAt: string;
  /** 사람이 고친 때 */
  editedAt?: string;
  /** 요약할 때의 메모 판. 지금 판과 다르면 "원문이 바뀌었어요." */
  memoRevision: number;
  runId?: ID;
}
export interface Feedback extends BaseRecord {
  origin?: RecordOrigin;
  title: string;
  body: string;
  meetingId?: ID;
  sourceQuote?: string;
  sourceMemoRevision?: number;
  sourceStart?: number;
  sourceEnd?: number;
  /** 전사문에서 고른 구간으로 만든 피드백의 녹음 위치(녹음 시작 기준 ms). */
  audioSource?: AudioSource;
  status: "unprocessed" | "in_progress" | "recorded" | "held" | "unchanged";
  notes: string;
}
/** 피드백이 나온 녹음 구간. recordingId가 없으면 그 미팅의 첫 녹음을 씁니다. */
export interface AudioSource {
  meetingId: ID;
  recordingId?: ID;
  startMs: number;
  endMs: number;
}
export interface RevisionPlan extends BaseRecord {
  origin?: RecordOrigin;
  feedbackId: ID;
  title: string;
  method: string;
  expectedResult: string;
  assumptions: string;
  sourceQuote?: string;
  requiredMaterials: string;
  suggestedTasks: string[];
  status: "suggested" | "saved" | "cancelled";
}
export interface Task extends BaseRecord {
  origin?: RecordOrigin;
  title: string;
  description: string;
  status: "todo" | "doing" | "done";
  dueDate: string | null;
  priority: "high" | "normal" | "low";
  feedbackIds: ID[];
  planId?: ID;
  assigneeId?: ID;
  phaseId?: ID;
  /** 이 할 일이 나온 기록(미팅·서면 피드백). 피드백 없이 기록에서 바로 만든 할 일에 씁니다(08 §3). */
  sourceRecordId?: ID;
  /** 메모에서 고른 글로 만들었을 때의 인용과 위치(IA v2 08 §4.6) */
  sourceQuote?: string;
  sourceMemoRevision?: number;
  sourceStart?: number;
  sourceEnd?: number;
  /** 이 할 일로 고칠 글(IA v2 08 §3). 그 글의 여백에 보입니다. */
  documentId?: ID;
  /** 그 글의 어느 제목 아래인지(제목 글자). 없거나 찾지 못하면 글 맨 위 여백. */
  sectionAnchor?: string;
}
export interface Question extends BaseRecord {
  origin?: RecordOrigin;
  meetingId?: ID;
  text: string;
  status: "open" | "resolved";
  /** 메모에서 고른 글로 만들었을 때의 인용과 위치(IA v2 08 §4.6) */
  sourceQuote?: string;
  sourceMemoRevision?: number;
  sourceStart?: number;
  sourceEnd?: number;
}
export interface Decision extends BaseRecord {
  origin?: RecordOrigin;
  meetingId: ID;
  text: string;
  /** 이렇게 정한 이유. 선택입니다. */
  reason?: string;
  /** 이 결정이 바꾸는 이전 결정. 방향이 바뀌었을 때 고릅니다. */
  replacesId?: ID;
  /** 메모에서 고른 글로 만들었을 때의 인용과 위치(IA v2 08 §4.6) */
  sourceQuote?: string;
  sourceMemoRevision?: number;
  sourceStart?: number;
  sourceEnd?: number;
}
export interface Material extends BaseRecord {
  title: string;
  type: "draft" | "reference" | "analysis" | "other";
  externalUrl?: string;
  folderId?: ID;
}
export interface MaterialVersion extends BaseRecord {
  materialId: ID;
  number: number;
  fileName: string;
  storagePath: string;
  size: number;
  mimeType: string;
}
export interface RevisionResult extends BaseRecord {
  title: string;
  description: string;
  feedbackIds: ID[];
  taskIds: ID[];
  kind: "document" | "other";
  versionId?: ID;
  location: string;
}
export interface ReviewRequest extends BaseRecord {
  title: string;
  professorEmail: string;
  professorId?: ID;
  status: "draft" | "shared" | "stopped";
  /** 서버가 함께 보내는 연구 이름과 연구 방향. 교수님이 검토할 때 맥락으로 봅니다. */
  researchName?: string;
  researchPurpose?: string;
  researchQuestions?: string[];
}
export interface ReviewItem {
  id: ID;
  requestId: ID;
  resultId: ID;
  title: string;
}
export interface ReviewRound {
  createdBy?: ID;
  createdByName?: string;
  id: ID;
  requestId: ID;
  itemId: ID;
  number: number;
  title: string;
  description: string;
  feedbackExcerpt: string;
  versionId?: ID;
  fileName?: string;
  storagePath?: string;
  location: string;
  createdAt: string;
}
export interface ReviewResponse {
  id: ID;
  roundId: ID;
  userId: ID;
  result: "confirmed" | "changes_requested";
  comment: string;
  createdAt: string;
  updatedAt: string;
}
export interface ReviewComment {
  id: ID;
  roundId: ID;
  userId: ID;
  authorName: string;
  body: string;
  parentId?: ID;
  resolved: boolean;
  createdAt: string;
  /** 쓴 사람이 본문을 고친 시각. 고친 적이 없으면 없습니다. */
  editedAt?: string;
  /** 쓴 사람이 삭제한 시각. 답글이 이어질 수 있어 자리는 남기고 본문만 가립니다. */
  deletedAt?: string;
}
export interface ReviewRead {
  roundId: ID;
  userId: ID;
  lastSeenAt: string;
}

export interface DocumentRecord extends BaseRecord {
  title: string;
  type: "plan" | "manuscript" | "note";
  content: Record<string, unknown>;
  text: string;
  revision: number;
  /** 글도 폴더에 넣을 수 있어요(IA v2 08 §3.5). */
  folderId?: ID;
}
export interface DocumentVersion extends BaseRecord {
  documentId: ID;
  title: string;
  number: number;
  content: Record<string, unknown>;
  text: string;
}
export interface MaterialFolder extends BaseRecord {
  title: string;
  parentId?: ID;
}
export interface ResearchPhase extends BaseRecord {
  title: string;
  order: number;
  /** 단계를 시작하는 날(YYYY-MM-DD). 없으면 월별 보기에 막대를 그리지 않습니다. */
  startDate?: string | null;
  dueDate: string | null;
  status: "planned" | "active" | "done";
  dependsOn: ID[];
  position?: { x: number; y: number };
}
export interface Milestone extends BaseRecord {
  title: string;
  phaseId?: ID;
  dueDate: string | null;
  taskIds: ID[];
  documentIds: ID[];
  status: "planned" | "done";
}
export interface Recording extends BaseRecord {
  meetingId: ID;
  title: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  size: number;
  duration: number;
  consentAt: string;
  /** 전사 원문(raw_segments)과 같은 순서의 문장별 녹음 위치·인식 신뢰도. 글자는 담지 않아요. */
  segmentTimes?: SegmentTime[];
  /** 전사 수정문에 칠한 형광펜 범위. 글자 대신 위치와 확인용 해시만 담아요. */
  transcriptMarks?: TranscriptMark[];
}
/** 전사 문장 하나의 녹음 시작 기준 위치(ms)와 인식 신뢰도(0이면 브라우저가 주지 않은 것). */
export interface SegmentTime {
  startMs: number;
  endMs: number;
  confidence?: number;
}
/** 전사 수정문의 [start, end) 범위. hash가 지금 글자와 다르면 표시하지 않아요. */
export interface TranscriptMark {
  start: number;
  end: number;
  hash: string;
}
export interface AIContext {
  kind:
    | "meetings"
    | "feedback"
    | "documents"
    | "versions"
    | "attachments"
    | "tasks"
    | "phases"
    | "milestones"
    // 연구 도우미가 이 연구에서 직접 읽어 온 기록(서버가 붙임)
    | "questions"
    | "decisions"
    | "materials"
    // 미팅 정리에서 서버가 붙인 내 전사문(제목만, 글자는 남기지 않음)
    | "recordings";
  id: ID;
  title: string;
  revision?: number;
  text?: string;
  page?: number;
}
export interface WebGrounding {
  sources: { url: string; title: string }[];
  citations: {
    startIndex: number;
    endIndex: number;
    sourceIndices: number[];
  }[];
  queries: string[];
  searchEntryPointHtml?: string;
}
export interface AIConversationMessage {
  webSearch?: boolean;
  calendar?: boolean;
  webGrounding?: WebGrounding;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
  steps?: string[];
  elapsedMs?: number;
  contexts?: AIContext[];
}

export interface AIConversation extends BaseRecord {
  title: string;
  messages: AIConversationMessage[];
  contexts: AIContext[];
}
export interface Attachment extends BaseRecord {
  textExtractionVersion?: 2;
  title: string;
  fileName: string;
  storagePath: string;
  mimeType: string;
  size: number;
  text: string;
}
export interface SavedAICandidate extends BaseRecord {
  runId: ID;
  mode?: string;
  contexts?: AIContext[];
  title: string;
  candidate: AICandidate;
  status: "pending" | "adopted" | "dismissed";
  savedRecordId?: ID;
}
export interface ResearchMember {
  researchId: ID;
  userId: ID;
  role: "owner" | "editor";
  name: string;
  email: string;
  status: "pending" | "active";
  invitedBy?: ID;
}
export interface ActivityEvent {
  id: ID;
  researchId: ID;
  actorId: ID;
  actorName: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  readAt?: string;
  kind: string;
}
export interface MeetingPoll {
  id: ID;
  researchId: ID;
  title: string;
  organizerId: ID;
  researchName: string;
  options: { id: ID; start: string; end: string }[];
  participants: { userId: ID; name: string; email: string; available: ID[] }[];
  status: "open" | "confirmed" | "cancelled";
  meetingId?: ID;
  selectedOptionId?: ID;
  updatedAt: string;
}
export interface AIRun {
  id: ID;
  researchId: ID;
  userId: ID;
  mode: string;
  model?: string;
  thinking?: string;
  status: "running" | "complete" | "failed" | "cancelled";
  createdAt: string;
  completedAt?: string;
  error?: string;
}
export const phaseTitles = [
  t("주제 정의"),
  t("선행연구"),
  t("연구 설계"),
  t("자료 수집·분석"),
  t("집필"),
  t("최종 수정·제출"),
];

export interface EntityMap {
  documents: DocumentRecord;
  documentVersions: DocumentVersion;
  folders: MaterialFolder;
  phases: ResearchPhase;
  milestones: Milestone;
  recordings: Recording;
  conversations: AIConversation;
  attachments: Attachment;
  aiCandidates: SavedAICandidate;
  meetings: Meeting;
  feedback: Feedback;
  plans: RevisionPlan;
  tasks: Task;
  questions: Question;
  decisions: Decision;
  materials: Material;
  versions: MaterialVersion;
  results: RevisionResult;
}
export type EntityKind = keyof EntityMap;
export interface WorkspaceData {
  documents: DocumentRecord[];
  documentVersions: DocumentVersion[];
  folders: MaterialFolder[];
  phases: ResearchPhase[];
  milestones: Milestone[];
  recordings: Recording[];
  conversations: AIConversation[];
  attachments: Attachment[];
  aiCandidates: SavedAICandidate[];
  members: ResearchMember[];
  events: ActivityEvent[];
  polls: MeetingPoll[];
  aiRuns: AIRun[];
  researches: Research[];
  meetings: Meeting[];
  feedback: Feedback[];
  plans: RevisionPlan[];
  tasks: Task[];
  questions: Question[];
  decisions: Decision[];
  materials: Material[];
  versions: MaterialVersion[];
  results: RevisionResult[];
  reviews: ReviewRequest[];
  reviewItems: ReviewItem[];
  rounds: ReviewRound[];
  responses: ReviewResponse[];
  comments: ReviewComment[];
  reads: ReviewRead[];
}
export interface AppUser {
  preferences?: Record<string, string | boolean>;
  id: ID;
  email: string;
  name: string;
}
export interface AICandidate {
  title: string;
  body?: string;
  category?: "feedback" | "decision" | "question" | "task" | "summary";
  /** 미팅 정리: 발췌가 나온 원문. 위치(sourceStart~End)는 그 원문 기준(IA v2 08 §5.2) */
  sourceKind?: "memo" | "transcript";
  recordingId?: string;
  sourceQuote?: string;
  sourceStart?: number;
  sourceEnd?: number;
  method?: string;
  expectedResult?: string;
  assumptions?: string;
  requiredMaterials?: string;
  suggestedTasks?: string[];
}
export interface AIResult {
  contexts?: AIContext[];
  webGrounding?: WebGrounding;
  creditsUsed?: number;
  creditStatus?: "settled" | "pending";
  answer?: string;
  runId?: ID;
  candidates: AICandidate[];
  /** 원문에서 발췌를 찾지 못해 뺀 제안 수(미팅 정리) */
  droppedQuotes?: number;
  model: string;
  sourceRevision?: number;
  createdAt: string;
}
export interface AIInput {
  webSearch?: boolean;
  calendar?: boolean;
  mode:
    | "organize_meeting"
    | "suggest_revisions"
    | "ask_research"
    | "review_writing"
    | "plan_research"
    | "read_material"
    | "continue_writing"
    | "inline_edit";
  model?: string;
  thinking?: "minimal" | "low" | "medium" | "high";
  /** 화면 언어. 요청을 보낼 때 채워지고, 서버가 이 언어로 답하게 합니다. */
  locale?: "ko" | "ja";
  contexts?: AIContext[];
  conversationId?: ID;
  clientRunId?: ID;
  question?: string;
  history?: { role: "user" | "assistant"; text: string }[];
  researchId: ID;
  meetingId?: ID;
  feedbackId?: ID;
  sourceText: string;
  sourceRevision?: number;
}
export const emptyWorkspace = (): WorkspaceData => ({
  documents: [],
  documentVersions: [],
  folders: [],
  phases: [],
  milestones: [],
  recordings: [],
  conversations: [],
  attachments: [],
  aiCandidates: [],
  members: [],
  events: [],
  polls: [],
  aiRuns: [],
  researches: [],
  meetings: [],
  feedback: [],
  plans: [],
  tasks: [],
  questions: [],
  decisions: [],
  materials: [],
  versions: [],
  results: [],
  reviews: [],
  reviewItems: [],
  rounds: [],
  responses: [],
  comments: [],
  reads: [],
});
export const taskLabels = {
  todo: t("시작 전"),
  doing: t("진행 중"),
  done: t("완료"),
} as const;
export const originLabels = {
  manual: t("직접 작성"),
  ai: t("AI 제안에서 선택"),
} as const;
export const feedbackLabels = {
  unprocessed: t("시작 전"),
  in_progress: t("진행 중"),
  recorded: t("수정 결과 있음"),
  held: t("보류"),
  unchanged: t("고치지 않음"),
} as const;
export const meetingLabels = {
  preparing: t("준비 중"),
  recording: t("기록 중"),
  recorded: t("기록 완료"),
  cancelled: t("취소"),
} as const;
export const responseLabels = {
  confirmed: t("수정 내용 확인"),
  changes_requested: t("추가 수정 필요"),
} as const;
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function recordBase(researchId: string): BaseRecord {
  const stamp = now();
  return { id: uid(), researchId, createdAt: stamp, updatedAt: stamp };
}
export function formatDate(
  date?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!date) return t("날짜 미정");
  return new Intl.DateTimeFormat(
    dateLocale(),
    options ?? { month: "long", day: "numeric", weekday: "short" },
  ).format(new Date(`${date.slice(0, 10)}T12:00:00`));
}
/**
 * 기록 시각(ISO 타임스탬프)을 화면 표기 하나로 씁니다: ‘11월 9일 (월) 오후 2:00’(기기가 24시간제면 ‘14:00’, lib/time-format.ts).
 * 올해가 아니면 연도를 앞에 붙이고, 초는 쓰지 않습니다. `time: false`면 날짜만.
 */
export function formatDateTime(
  value?: string | null,
  { time = true }: { time?: boolean } = {},
) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.valueOf())) return "";
  return new Intl.DateTimeFormat(dateLocale(), {
    ...(d.getFullYear() !== new Date().getFullYear() && { year: "numeric" }),
    month: "long",
    day: "numeric",
    weekday: "short",
    ...(time && timeParts()),
  }).format(d);
}
const DAY_MS = 86_400_000;
/** 오늘 기준 남은 날 수를 ‘오늘·내일·3일 뒤·2일 지남’으로 씁니다. */
export function relativeDay(date?: string | null, today = new Date()) {
  if (!date) return null;
  const target = new Date(`${date.slice(0, 10)}T12:00:00`);
  const base = new Date(today);
  base.setHours(12, 0, 0, 0);
  const days = Math.round((target.getTime() - base.getTime()) / DAY_MS);
  if (days === 0) return t("오늘");
  if (days === 1) return t("내일");
  return days > 0
    ? t("{days}일 뒤", { days })
    : t("{days}일 지남", { days: -days });
}
export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * 지금 화면(연구 도우미 제안 탭·미팅 AI 정리)이 다룰 수 있는 미팅 정리 제안.
 * 요약·할 일 제안과 전사문에서 나온 제안은 기록 화면의 오른쪽 열(IA v2 2b)에서 다룹니다.
 */
export function isLegacyOrganizeCandidate(candidate: AICandidate): boolean {
  return (
    candidate.category !== "summary" &&
    candidate.category !== "task" &&
    candidate.sourceKind !== "transcript"
  );
}
