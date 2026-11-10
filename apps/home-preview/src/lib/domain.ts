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
  deletedAt?: string;
  example?: boolean;
  archivedAt?: string;
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
  status: "unprocessed" | "in_progress" | "recorded" | "held" | "unchanged";
  notes: string;
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
}
export interface Question extends BaseRecord {
  origin?: RecordOrigin;
  meetingId?: ID;
  text: string;
  status: "open" | "resolved";
}
export interface Decision extends BaseRecord {
  origin?: RecordOrigin;
  meetingId: ID;
  text: string;
  /** 이렇게 정한 이유. 선택입니다. */
  reason?: string;
  /** 이 결정이 바꾸는 이전 결정. 방향이 바뀌었을 때 고릅니다. */
  replacesId?: ID;
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
    | "milestones";
  id: ID;
  title: string;
  revision?: number;
  text?: string;
  page?: number;
}
export interface AIConversation extends BaseRecord {
  title: string;
  messages: { role: "user" | "assistant"; text: string; createdAt: string }[];
  contexts: AIContext[];
}
export interface Attachment extends BaseRecord {
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
  "주제 정의",
  "선행연구",
  "연구 설계",
  "자료 수집·분석",
  "집필",
  "최종 수정·제출",
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
  category?: "feedback" | "decision" | "question";
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
  answer?: string;
  runId?: ID;
  candidates: AICandidate[];
  model: string;
  sourceRevision?: number;
  createdAt: string;
}
export interface AIInput {
  mode:
    | "organize_meeting"
    | "suggest_revisions"
    | "ask_research"
    | "review_writing"
    | "plan_research"
    | "read_material";
  model?: string;
  thinking?: "minimal" | "medium" | "high";
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
  todo: "시작 전",
  doing: "진행 중",
  done: "완료",
} as const;
export const originLabels = {
  manual: "직접 작성",
  ai: "AI 제안에서 선택",
} as const;
export const feedbackLabels = {
  unprocessed: "시작 전",
  in_progress: "진행 중",
  recorded: "수정 결과 있음",
  held: "보류",
  unchanged: "고치지 않음",
} as const;
export const meetingLabels = {
  preparing: "준비 중",
  recording: "기록 중",
  recorded: "기록 완료",
  cancelled: "취소",
} as const;
export const responseLabels = {
  confirmed: "수정 내용 확인",
  changes_requested: "추가 수정 필요",
} as const;
export const uid = () => crypto.randomUUID();
export const now = () => new Date().toISOString();
export function recordBase(researchId: string): BaseRecord {
  const t = now();
  return { id: uid(), researchId, createdAt: t, updatedAt: t };
}
export function formatDate(
  date?: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!date) return "날짜 미정";
  return new Intl.DateTimeFormat(
    "ko-KR",
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
  return new Intl.DateTimeFormat("ko-KR", {
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
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  return days > 0 ? `${days}일 뒤` : `${-days}일 지남`;
}
export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}
